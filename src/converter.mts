import type * as OpenAPI from "./openapi.mjs"
import type { Primitive, Group, Field, Parameter, Method, Game } from "./api.mjs"
import { JSONNull, JSONObject, JSONArray, JSON, inferJSON } from "./inference.mjs"

import * as fs from "fs";
import * as path from "path";

type APINull = null
type APIArray = APIGroup[]
type APIObject = { [key: string]: APIField }
type APIRecord = { [key: string]: APIGroup }
type APIGroup = APIObject | APIArray | APIRecord | APINull
type APIAssociativeArray = { [key: string]: APIPrimitive }
type APIList = APIPrimitive[]
type APIPrimitive = string | number | boolean | APINull | APIAssociativeArray | APIList
type APIField = APIGroup | APIPrimitive

function getPath(method_key: string) {
    return `/${method_key.split("_").slice(1).join("/")}/`;
}

function convertParameter(parameter: Parameter): OpenAPI.Schema {
    const res: OpenAPI.Schema = { };


    let { name, doc_type, help_text, required } = parameter;

    let validValuesMatch = help_text.match(/Valid values:\n\n(.*)$/s);
    let validValues: string[] = [];
    let validValuesDescription: string[] = [];

    if (validValuesMatch?.length === 2) {
        let check = true;
        validValuesMatch[1].split("\n").map(e => {
            let match = e.replace("&mdash;", "-").match(/\* *\"(.+?)\" *(?:- *(.*))?/);

            if (match && match?.length >= 2) {
                validValues.push(match[1])
                if (match[2] !== undefined) {
                    validValuesDescription.push(match[2])
                }
            }
            else {
                check = false;
            }
        })

        if (check) {
            help_text = help_text.replace(validValuesMatch[0], "");
        }
    }

    if (doc_type.startsWith("numeric")) {
        let type: OpenAPI.Schema & { "x-enumDescriptions"?: string[] } = { type: "integer" };

        if (validValues.length > 0) type.enum = validValues.map(value => parseInt(value));
        if (validValuesDescription.length > 0) type["x-enumDescriptions"] = validValuesDescription.map(description => description.trim());

        let minMatch = help_text.match(/Min value is (\d+)\./);
        let maxMatch = help_text.match(/Maximum value: (\d+)\./);
        let defaultMatch = help_text.match(/Default is (\d+)\./);

        if (minMatch?.length === 2) {
            type.minimum = parseInt(minMatch[1])
            help_text = help_text.replace(minMatch[0], "");
        }
        if (maxMatch?.length === 2) {
            type.maximum = parseInt(maxMatch[1])
            help_text = help_text.replace(maxMatch[0], "");
        }
        if (defaultMatch?.length === 2) {
            type.default = parseInt(defaultMatch[1])
            help_text = help_text.replace(defaultMatch[0], "");
        }

        let limitMatch = help_text.match(/ \(fewer can be returned, but not more than (\d+|None)\)\. If the limit sent exceeds (\d+|None), a limit of (\d+|None) is applied \(by default\)/);

        if (limitMatch?.length === 4) {
            if (limitMatch[1] !== "None") type.maximum = parseInt(limitMatch[1]);
            if (limitMatch[3] !== "None") type.default = parseInt(limitMatch[3]);
            help_text = help_text.replace(limitMatch[0], "");
        }

        if (doc_type === "numeric, list") {
            res.type = "array";
            res.items = type;

            if (required) res.minItems = 1;

            let maxMatch = help_text.match(/Maximum limit: (\d+)\./);

            if (maxMatch?.length === 2) {
                res.maxItems = parseInt(maxMatch[1])
                help_text = help_text.replace(maxMatch[0], "");
            }

            return res;
        }
        else {
            return type;
        }
    }
    if (doc_type.startsWith("string")) {
        let type: OpenAPI.Schema & { "x-enumDescriptions"?: string[] } = { type: "string" };

        if (validValues.length > 0) type.enum = validValues.map(value => value.replace(/\"/g, "").trim());
        if (validValuesDescription.length > 0) type["x-enumDescriptions"] = validValuesDescription.map(description => description.trim());

        let defaultMatch = help_text.match(/Default is \"(.+)\"\./);

        if (doc_type === "string, list") {
            let res: OpenAPI.Schema = { type: "array", items: type };

            if (defaultMatch?.length === 2) {
                res.default = defaultMatch[1].split(",").map(s => s.trim());
                help_text = help_text.replace(defaultMatch[0], "");
            }

            if (required) res.minItems = 1;

            let maxMatch = help_text.match(/Maximum limit: (\d+)\./);

            if (maxMatch?.length === 2) {
                res.maxItems = parseInt(maxMatch[1])
                help_text = help_text.replace(maxMatch[0], "");
            }

            return res;
        }
        else {
            if (defaultMatch?.length === 2) {
                type.default = defaultMatch[1]
                help_text = help_text.replace(defaultMatch[0], "");
            }

            return type;
        }
    }

    if (doc_type === "timestamp/date") {
        res.oneOf = [{
            type: "integer"
        }, {
            type: "string",
            format: "date-time"
        }]
    }

    res.description = fixDescription(help_text);

    return res;

    throw new Error(`Unknown type: ${doc_type}`);
}

/**
 * Converts a Wargaming API primitive field definition into an OpenAPI schema object.
 *
 * @param primitive The primitive field definition from the Wargaming API specification.
 * @param tests An array of test values used to infer additional schema properties.
 * @returns An OpenAPI schema object representing the primitive field.
 */
export function convertPrimitive({ doc_type, required }: Primitive, tests: APIPrimitive[]): OpenAPI.Schema {
    const schema: OpenAPI.Schema = {};
    const testsNotNull = tests.filter(test => test !== null);

    if (doc_type === "string") schema.type = "string";
    else if (doc_type === "numeric" || doc_type === "timestamp") schema.type = "integer";
    else if (doc_type === "float") {
        schema.type = "number";
        schema.format = "float";
    }
    else if (doc_type === "boolean") schema.type = "boolean";
    else if (doc_type === "associative array") {
        schema.type = "object";
        schema.additionalProperties = inferJSON(testsNotNull.reduce((tests: APIAssociativeArray[], test) => [...Object.values(test), ...tests], []));
    }
    else if (doc_type === "object") schema.type = "object";
    else if (doc_type === "list of booleans" || doc_type === "list of floats" || doc_type === "list of integers" || doc_type === "list of strings" || doc_type === "list of timestamps") {
        let types = {
            "list of integers": "numeric",
            "list of strings": "string",
            "list of booleans": "boolean",
            "list of timestamps": "timestamp",
            "list of floats": "float"
        }

        let doc_type2 = types[doc_type] as Primitive["doc_type"];

        let extendedTests = (testsNotNull as APIList[]).reduce((tests: APIPrimitive[], test) => [...test, ...tests], []);

        schema.type = "array";
        schema.items = convertPrimitive({ doc_type: doc_type2, required }, extendedTests);

        return schema;
    }

    if (testsNotNull.length < tests.length) {
        if (typeof schema.type === "string") schema.type = [schema.type, "null"];
        else schema.type = "null";
    }

    return schema;
}



/**
 * Converts a Wargaming API group field (object, record, or array) into an OpenAPI schema object.
 *
 * @param group The group field definition from the Wargaming API, representing a structured type such as an object or array.
 * @param tests An array of example values used to refine the schema.
 * @returns An OpenAPI schema object representing the group structure.
 */
export function convertGroup(group: Group, tests: APIGroup[]): OpenAPI.Schema {
    const { fields } = group;

    let partial_match = false;

    const arrayValues: any[][] = [];
    const recordValues: { [key: string]: any }[] = [];
    const objectValues: { [key: string]: any }[] = [];
    const nullValues: null[] = [];

    for (let test of tests) {
        if (test === null) nullValues.push(test);
        else if (Array.isArray(test)) arrayValues.push(test);
        else {
            if (typeof test === "object") {
                if (fields.every(field => field.name in test)
                    || (fields.some(field => field.name in test) && !Object.values(test).every(value => fields.every(field => typeof value === "object" && (value == null || field.name in value))))) {

                    if (!fields.every(field => field.name in test)) partial_match = true;

                    objectValues.push(test);
                }
                else {
                    recordValues.push(test);
                }
            }
            else throw new Error(`Expected: object. Got: ${typeof test}.`);
        }
    }

    if (partial_match) console.warn(`Partial group match.`);

    function inferObject(tests: APIObject[]): OpenAPI.Schema {
        return {
            type: "object",
            properties: Object.fromEntries(fields.map(field => convertField(field, tests.filter(test => test[field.name] !== undefined).map(test => test[field.name])))),
            required: fields.filter(field => !field.help_text.includes("**An extra field.**")).map(field => field.name)
        }
    }

    function inferArray(tests: APIArray[]): OpenAPI.Schema {
        return {
            type: "array",
            items: convertGroup(group, tests.reduce((tests, test) => [...test, ...tests], []))
        }
    }

    function inferRecord(tests: APIRecord[]): OpenAPI.Schema {
        return {
            type: "object",
            additionalProperties: convertGroup(group, tests.reduce((tests: APIGroup[], test) => [...Object.values(test), ...tests], []))
        }
    }

    const oneOf: OpenAPI.Schema[] = [];

    if (arrayValues.length > 0) oneOf.push(inferArray(arrayValues));
    if (objectValues.length > 0) oneOf.push(inferObject(objectValues));
    if (recordValues.length > 0) oneOf.push(inferRecord(recordValues));

    if (oneOf.length === 0) console.warn(`Not enough tests to infer type of group.`);

    if (nullValues.length > 0) oneOf.push({ type: "null" });

    return oneOf.length === 0 ? {} : oneOf.length === 1 ? oneOf[0] : { oneOf };
}

function fixDescription(description: string) {
    return description.replace("](/", "](https://developers.wargaming.net/").trim()
}

/**
 * Converts a Wargaming API field (either primitive or group) into a named OpenAPI schema property.
 *
 * @param field The field definition from the Wargaming API, either a primitive value or a structured group.
 * @param tests An array of example values used to infer schema characteristics.
 * @returns A tuple containing the field name and the corresponding OpenAPI schema object.
 */
export function convertField(field: Field, tests: APIField[]): [string, OpenAPI.Schema] {
    let schema = "fields" in field ? convertGroup(field, tests as APIGroup[]) : convertPrimitive(field, tests as APIPrimitive[]);

    if (field.help_text) schema.description = field.help_text.replace("**An extra field.**", "").trim();

    return [field.name, schema];
}

/**
 * Generates an OpenAPI GET Parameter object from a Wargaming.net API parameter definition.
 *
 * @param parameter The Wargaming.net API GET parameter definition to convert.
 * @returns The resulting OpenAPI Parameter object.
 */
export function convertGETParameter(parameter: Parameter): OpenAPI.Parameter {
    let { description, ...schema } = convertParameter(parameter);

    let res: OpenAPI.Parameter = {
        name: parameter.name,
        description,
        in: "query",
        schema
    }

    if (parameter.required) res.required = true;
    if (parameter.deprecated) res.deprecated = true;
    if ("type" in schema && schema.type === "array") {
        res.style = "form";
        res.explode = false;
    }

    return res;
}

/**
 * Generates an OpenAPI POST Parameter object from a Wargaming.net API parameter definition.
 *
 * @param parameter The Wargaming.net API POST parameter definition to convert.
 * @returns The resulting OpenAPI Schema object.
 */
export function convertPOSTParameter(parameter: Parameter): [string, OpenAPI.Schema] {
    return [parameter.name, convertParameter(parameter)]
}

/**
 * Generates an OpenAPI POST Parameter object from a Wargaming.net API parameter definition.
 *
 * @param parameter The Wargaming.net API POST parameter definition to convert.
 * @returns The resulting OpenAPI Schema object.
 */
export function convertPOSTParameters(parameters: Parameter[]): OpenAPI.RequestBody {
    return {
        required: true,
        content: {
            "application/x-www-form-urlencoded": {
                schema: {
                    type: "object",
                    properties: Object.fromEntries(parameters.sort(sortParameters).map(convertPOSTParameter)),
                    required: parameters.filter(parameter => parameter.required).map(parameter => parameter.name)
                }
            }
        }
    }
}



function getJsonFilesSync(folderPath: string): any[] {
    const jsonFiles = fs.readdirSync(folderPath).filter(file => file.endsWith(".json"));

    return jsonFiles.map(file => {
        const content = fs.readFileSync(path.join(folderPath, file), "utf-8");
        return JSON.parse(content);
    });
}

function sortParameters(a: Parameter, b: Parameter) {
    if (a.name === "application_id" || (a.required && !b.required)) return -1;
    else if (b.name === "application_id" || (b.required && !a.required)) return 1;
    else return a.name.localeCompare(b.name);
}

/**
 * Generates an OpenAPI PathItem for a given method definition.
 *
 * @param method The Wargaming.net method definition to convert.
 * @param parameters A list of parameter names to reference or include.
 * @returns A tuple containing the API path and the corresponding PathItem object.
 */
export function convertMethod(method: Method, parameters: string[]): [string, OpenAPI.PathItem] {
    let tests = getJsonFilesSync(`tests/${method.method_key.split("_").join("/")}`);

    let schema: OpenAPI.Schema = {
        oneOf: [{
            "type": "object",
            "properties": {
                "status": {
                    type: "string",
                    enum: ["ok"]
                },
                "meta": {
                    type: "object",
                    properties: {
                        count: {
                            type: "number"
                        }
                    }
                },
                data: convertGroup(method.output_form_info ? method.output_form_info : { fields: [] }, tests.map(test => test.data))
            },
            required: ["status", "meta", "data"]
        }, {
            "type": "object",
            "properties": {
                "status": {
                    type: "string",
                    enum: ["error"]
                },
                error: {
                    type: "object",
                    properties: {
                        code: { type: "number" },
                        message: { type: "string" }
                    },
                    required: ["code", "message"]
                }
            },
            required: ["status", "error"]
        }]
    }
    //let schema2: OpenAPI.Schema = convertDataFields(method.output_form_info ?? {
    //    "help_text": "",
    //    "fields": [],
    //    "deprecated_text": "",
    //    "name": "",
    //    "deprecated": false
    //}, tests.map(test => test.data))[1]

    const responses = {
        200: {
            description: "OK",
            content: {
                "application/json": {
                    schema
                }
            }
        }
    }

    let pathItem: OpenAPI.PathItem = {
    };

    let methodKey = method.method_key.split("_");
    let [game, category, key] = methodKey;

    if (method.allowed_http_methods.includes("GET")) {
        pathItem.get = {
            summary: method.name,
            description: method.description,
            operationId: ["get", ...methodKey.slice(1)].join("_"),
            parameters: method.input_form_info.fields.filter(parameter => parameter.name !== "application_id" && (parameter.name !== "language" || parameters.includes(`${category}_language`))).sort(sortParameters).map(parameter => {
                if (parameters.includes(parameter.name)) return { "$ref": `#/components/parameters/${parameter.name}` };
                else if (parameter.name === "language") return { "$ref": `#/components/parameters/${category}_language` };
                else return convertGETParameter(parameter)
            }),
            responses,
            tags: [method.category_name],
            externalDocs: {
                url: `https://developers.wargaming.net/reference/all/${methodKey[0]}/${methodKey[1]}/${methodKey[2]}/`
            }
        }
    }
    else {
        pathItem.post = {
            summary: method.name,
            description: method.description,
            operationId: methodKey.slice(2).join("_"),
            requestBody: convertPOSTParameters(method.input_form_info.fields.filter(parameter => parameter.name !== "application_id")),
            responses,
            tags: [method.category_name],
            externalDocs: {
                url: `https://developers.wargaming.net/reference/all/${methodKey[0]}/${methodKey[1]}/${methodKey[2]}/`
            }
        }
    }

    return [`/${method.url}/`, pathItem];
}

/**
 * Generates a complete OpenAPI specification from a Wargaming.net API specification.
 *
 * @param game The Wargaming.net game API specification to convert.
 * @param servers The list of Wargaming.net API servers for the specified game.
 * @param parameters Global OpenAPI parameters to apply across operations.
 * @returns A fully constructed OpenAPI specification object.
 */
export function convertGame(game: Game, servers: OpenAPI.Server[], parameters: Record<string, OpenAPI.Parameter>): OpenAPI.OpenAPI {
    return {
        openapi: "3.1.0",
        info: {
            title: game.long_name ?? game.name,
            description: "OpenAPI specification for the Wargaming.net Public API.\nThe official Wargaming.net Public API documentation can be found at the Wargaming [Developer's room](https://developers.wargaming.net/).",
            termsOfService: "https://developers.wargaming.net/documentation/rules/agreement/",
            contact: {
                name: "Ace Tanker",
                url: "https://ace-tanker.net",
                email: "contact@ace-tanker.net"
            },
            license: {
                "name": "MIT",
                "url": "https://opensource.org/licenses/MIT"
            },
            version: "1.0.0"
        },
        servers,
        components: {
            parameters,
            schemas: {

            },
            securitySchemes: {
                application_id: {
                    name: "application_id",
                    description: "[Application](https://developers.wargaming.net/applications/) identification key used to send requests to API.",
                    in: "query",
                    type: "apiKey"
                }
            }
        },
        security: [{
            application_id: []
        }],
        paths: Object.fromEntries(game.methods.filter(method => {
            if (method.deprecated) {
                console.warn(`Method deprecated ignored: ${method.method_key}.`);

                return false;
            }

            if (fs.existsSync(`tests/${method.method_key.split("_").join("/")}`)) return true;
            else {
                console.warn(`Tests not found, method ignored: ${method.method_key}.`);

                return false;
            }
        }).map(method => convertMethod(method, Object.keys(parameters))))
    }
}

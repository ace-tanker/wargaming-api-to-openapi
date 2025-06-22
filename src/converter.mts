/**
 * This file exposes methods to convert an API reference into an OpenAPI specification.
 */

import type * as OpenAPI from "./openapi.mjs"
import type { Primitive, Group, Field, Parameter, Method, Game } from "./api.mjs"
import { inferJSON } from "./inference.mjs"
import * as Types from "./api-tools.mjs"

const version: "3.1.0" | "3.0.0" = "3.0.0";

/**
 * Converts a Wargaming API parameter definition into an OpenAPI schema object.
 *
 * @param primitive The parameter field definition from the Wargaming API specification.
 * @returns An OpenAPI schema object representing the parameter field.
 */
function convertParameter({ doc_type, help_text, required }: Parameter): OpenAPI.Schema {
    const schema: OpenAPI.Schema = { };

    const validValuesMatch = help_text.match(/Valid values:\n\n(.*)$/s);
    const validValues: string[] = [];
    const validValuesDescription: string[] = [];

    if (validValuesMatch?.length === 2) {
        let check = true;

        validValuesMatch[1].split("\n").map(e => {
            const match = e.replace("&mdash;", "-").match(/\* *\"(.+?)\" *(?:- *(.*))?/);

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
        const type: OpenAPI.Schema = { type: "integer" };

        if (validValues.length > 0) type.enum = validValues.map(value => parseInt(value));
        if (validValuesDescription.length > 0) type["x-enumDescriptions"] = validValuesDescription.map(description => description.trim());

        const minMatch = help_text.match(/Min value is (\d+)\./);
        const maxMatch = help_text.match(/Maximum value: (\d+)\./);
        const defaultMatch = help_text.match(/Default is (\d+)\./);

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

        const limitMatch = help_text.match(/ \(fewer can be returned, but not more than (\d+|None)\)\. If the limit sent exceeds (\d+|None), a limit of (\d+|None) is applied \(by default\)/);

        if (limitMatch?.length === 4) {
            if (limitMatch[1] !== "None") type.maximum = parseInt(limitMatch[1]);
            if (limitMatch[3] !== "None") type.default = parseInt(limitMatch[3]);
            help_text = help_text.replace(limitMatch[0], "");
        }

        if (doc_type === "numeric, list") {
            schema.type = "array";
            schema.items = type;

            if (required) schema.minItems = 1;

            const maxMatch = help_text.match(/Maximum limit: (\d+)\./);

            if (maxMatch?.length === 2) {
                schema.maxItems = parseInt(maxMatch[1])
                help_text = help_text.replace(maxMatch[0], "");
            }

            return schema;
        }
        else {
            return type;
        }
    }

    if (doc_type.startsWith("string")) {
        const type: OpenAPI.Schema = { type: "string" };

        if (validValues.length > 0) type.enum = validValues.map(value => value.replace(/\"/g, "").trim());
        if (validValuesDescription.length > 0) type["x-enumDescriptions"] = validValuesDescription.map(description => description.trim());

        const defaultMatch = help_text.match(/Default is \"(.+)\"\./);

        if (doc_type === "string, list") {
            const schema: OpenAPI.Schema = { type: "array", items: type };

            if (defaultMatch?.length === 2) {
                schema.default = defaultMatch[1].split(",").map(s => s.trim());
                help_text = help_text.replace(defaultMatch[0], "");
            }

            if (required) schema.minItems = 1;

            const maxMatch = help_text.match(/Maximum limit: (\d+)\./);

            if (maxMatch?.length === 2) {
                schema.maxItems = parseInt(maxMatch[1])
                help_text = help_text.replace(maxMatch[0], "");
            }

            return schema;
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
        schema.oneOf = [{
            type: "integer"
        }, {
            type: "string",
            format: "date-time"
        }]
    }

    schema.description = help_text.replace("](/", "](https://developers.wargaming.net/").trim();

    return schema;
}

/**
 * Converts a Wargaming API primitive field definition into an OpenAPI schema object.
 *
 * @param primitive The primitive field definition from the Wargaming API specification.
 * @param tests An array of test values used to infer additional schema properties.
 * @returns An OpenAPI schema object representing the primitive field.
 */
export function convertPrimitive(doc_type: Primitive["doc_type"], tests: Types.Primitive[]): OpenAPI.Schema {
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
        schema.additionalProperties = inferJSON(testsNotNull.reduce((tests: Types.AssociativeArray[], test) => [...Object.values(test), ...tests], []));
    }
    else if (doc_type === "object") schema.type = "object";
    else if (doc_type === "list of booleans" || doc_type === "list of floats" || doc_type === "list of integers" || doc_type === "list of strings" || doc_type === "list of timestamps") {
        const types = {
            "list of integers": "numeric",
            "list of strings": "string",
            "list of booleans": "boolean",
            "list of timestamps": "timestamp",
            "list of floats": "float"
        }

        const doc_type2 = types[doc_type] as Primitive["doc_type"];

        const extendedTests = (testsNotNull as Types.List[]).reduce((tests: Types.Primitive[], test) => [...test, ...tests], []);

        schema.type = "array";
        schema.items = convertPrimitive(doc_type2, extendedTests);
    }

    return testsNotNull.length < tests.length ? version === "3.1.0" ? {
        oneOf: [schema, {
            type: "null"
        }]
    } : {
        nullable: true,
        ...schema
    } : schema;
}

/**
 * Converts a Wargaming API record group field into an OpenAPI schema object.
 *
 * @param group The group field definition from the Wargaming API.
 * @param tests An array of example values used to refine the schema.
 * @returns An OpenAPI schema object representing the group structure.
 */
export function convertRecord(group: Group, tests: Types.Record[]): OpenAPI.Schema {
    return {
        type: "object",
        additionalProperties: convertGroup(group, tests.reduce((tests: Types.Group[], test) => [...Object.values(test), ...tests], []))
    }
}

/**
 * Converts a Wargaming API array group field into an OpenAPI schema object.
 *
 * @param group The group field definition from the Wargaming API.
 * @param tests An array of example values used to refine the schema.
 * @returns An OpenAPI schema object representing the group structure.
 */
export function convertArray(group: Group, tests: Types.Array[]): OpenAPI.Schema {
    return {
        type: "array",
        items: convertGroup(group, tests.reduce((tests, test) => [...test, ...tests], []))
    }
}

/**
 * Converts a Wargaming API object group field into an OpenAPI schema object.
 *
 * @param group The group field definition from the Wargaming API.
 * @param tests An array of example values used to refine the schema.
 * @returns An OpenAPI schema object representing the group structure.
 */
export function convertObject({ fields }: Group, tests: Types.Object[]): OpenAPI.Schema {
    return {
        type: "object",
        properties: Object.fromEntries(fields.map(field => convertField(field, tests.filter(test => test[field.name] !== undefined).map(test => test[field.name])))),
        required: fields.filter(field => !field.help_text.includes("**An extra field.**")).map(field => field.name)
    }
}

/**
 * Converts a Wargaming API group field (object, record, or array) into an OpenAPI schema object.
 *
 * @param group The group field definition from the Wargaming API, representing a structured type such as an object or array.
 * @param tests An array of example values used to refine the schema.
 * @returns An OpenAPI schema object representing the group structure.
 */
export function convertGroup(group: Group, tests: Types.Group[]): OpenAPI.Schema {
    const arrayValues: Types.Array[] = [];
    const recordValues: Types.Record[] = [];
    const objectValues: Types.Object[] = [];
    const nullValues: null[] = [];
    const unexpectedValues: Types.Field[] = [];

    for (const test of tests) {
        if (test === null) nullValues.push(test);
        else if (Types.isArrayGroup(test, group)) arrayValues.push(test);
        else {
            if (typeof test === "object") {
                if (Types.isExtendedObjectGroup(test, group)) objectValues.push(test);
                else if (Types.isRecordGroup(test, group)) recordValues.push(test);
                else if (Types.isObjectGroup(test, group)) objectValues.push(test);
            }
            else unexpectedValues.push(test);
        }
    }

    const oneOf: OpenAPI.Schema[] = [];

    if (arrayValues.length > 0) oneOf.push(convertArray(group, arrayValues));
    if (objectValues.length > 0) oneOf.push(convertObject(group, objectValues));
    if (recordValues.length > 0) oneOf.push(convertRecord(group, recordValues));

    if (oneOf.length === 0)
        console.warn(`Not enough tests to infer type of group.`);
    if (oneOf.length > 1)
        console.warn(`Multiple schemas matched.`);
    if (unexpectedValues.length > 1)
        console.warn(`Got unexpected values from tests.`);

    if (version === "3.1.0" && nullValues.length > 0) oneOf.push({ type: "null" });

    return version === "3.1.0" ? oneOf.length === 0 ? {} : oneOf.length === 1 ? oneOf[0] : { oneOf }
        : oneOf.length === 0 ? {} : oneOf.length === 1 ? { ...oneOf[0], nullable: true } : { oneOf, nullable: true };
}

/**
 * Converts a Wargaming API field (either primitive or group) into a named OpenAPI schema property.
 *
 * @param field The field definition from the Wargaming API, either a primitive value or a structured group.
 * @param tests An array of example values used to infer schema characteristics.
 * @returns A tuple containing the field name and the corresponding OpenAPI schema object.
 */
export function convertField(field: Field, tests: Types.Field[]): [string, OpenAPI.Schema] {
    const schema = "fields" in field ? convertGroup(field, tests as Types.Group[]) : convertPrimitive(field.doc_type, tests as Types.Primitive[]);

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
    const { description, ...schema } = convertParameter(parameter);

    const res: OpenAPI.Parameter = {
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
export function convertMethod(method: Method, parameters: string[], getTests: (method: Method) => any[]): [string, OpenAPI.PathItem] {
    const tests = getTests(method);

    const meta = tests.filter(test => "meta" in test).map(test => test.meta);
    const metaKeys: Map<string, boolean> = meta.reduce((metaKeys: Map<string, boolean>, meta) => {
        for (const [key, value] of Object.entries(meta)) {
            if (!metaKeys.has(key)) metaKeys.set(key, false);

            if (value === null) metaKeys.set(key, true);
        }

        return metaKeys;
    }, new Map())

    const schema: OpenAPI.Schema = {
        oneOf: [{
            type: "object",
            properties: {
                status: version === "3.1.0" ? {
                    type: "string",
                    const: "ok"
                } : {
                    type: "string",
                    enum: ["ok"]
                },
                meta: {
                    type: "object",
                    properties: Object.fromEntries([...metaKeys.entries()].map(([key, nullable]) => {
                        const schema: OpenAPI.Schema = { type: "integer" };

                        return [key, nullable ? version === "3.1.0" ? { oneOf: [schema, { type: "null" }] } : { ...schema, nullable } : schema]
                    })),
                    required: metaKeys.size > 0 ? [...metaKeys.keys()] : undefined
                },
                data: method.output_form_info ? convertGroup(method.output_form_info, tests.map(test => test.data)) : {
                    type: "object",
                    properties: {}
                }
            },
            required: ["status", "meta", "data"]
        }, {
            type: "object",
            properties: {
                "status": version === "3.1.0" ? {
                    type: "string",
                    const: "error"
                } : {
                    type: "string",
                    enum: ["error"]
                },
                error: {
                    type: "object",
                    properties: {
                        code: { type: "number" },
                        message: { type: "string" },
                        field: { type: "string" },
                        value: { type: "string" }
                    },
                    required: ["code", "message", "field", "value"]
                }
            },
            required: ["status", "error"]
        }]
    }

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

    const pathItem: OpenAPI.PathItem = {};

    const methodKey = method.method_key.split("_");
    const [game, category, key] = methodKey;

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
export function convertGame(game: Game, { servers, parameters, filterMethod, getTests }: { servers: OpenAPI.Server[], parameters: Record<string, OpenAPI.Parameter>, filterMethod: (method: Method) => boolean, getTests: (method: Method) => any[] } = { servers: [], parameters: {}, filterMethod: method => false, getTests: method => [] }): OpenAPI.OpenAPI {
    return {
        openapi: version,
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
        paths: Object.fromEntries(game.methods.filter(filterMethod).map(method => convertMethod(method, Object.keys(parameters), getTests)))
    }
}

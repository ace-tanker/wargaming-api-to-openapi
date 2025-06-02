import type * as OpenAPI from "./openapi.mjs"
import type { Primitive, Group, Parameter, Method, Game } from "./api.mjs"

import * as fs from "fs";
import * as path from "path";

function getPath(method_key: string) {
    return `/${method_key.split("_").slice(1).join("/")}/`;
}

function convertParameterType(parameter: Parameter): OpenAPI.Schema {
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
            parameter.help_text = parameter.help_text.replace(validValuesMatch[0], "");
        }
    }

    //if (name === "language") return { "$ref": "#/components/schemas/language" };
    if (doc_type.startsWith("numeric")) {
        let type: OpenAPI.Schema = { type: "integer" };

        if (validValues.length > 0) type.enum = validValues.map(value => parseInt(value));
        if (validValuesDescription.length > 0) type["x-enumDescriptions"] = validValuesDescription.map(description => description.trim());

        let minMatch = help_text.match(/Min value is (\d+)\./);
        let maxMatch = help_text.match(/Maximum value: (\d+)\./);
        let defaultMatch = help_text.match(/Default is (\d+)\./);

        if (minMatch?.length === 2) {
            type.minimum = parseInt(minMatch[1])
            parameter.help_text = parameter.help_text.replace(minMatch[0], "");
        }
        if (maxMatch?.length === 2) {
            type.maximum = parseInt(maxMatch[1])
            parameter.help_text = parameter.help_text.replace(maxMatch[0], "");
        }
        if (defaultMatch?.length === 2) {
            type.default = parseInt(defaultMatch[1])
            parameter.help_text = parameter.help_text.replace(defaultMatch[0], "");
        }

        let limitMatch = help_text.match(/ \(fewer can be returned, but not more than (\d+|None)\)\. If the limit sent exceeds (\d+|None), a limit of (\d+|None) is applied \(by default\)/);

        if (limitMatch?.length === 4) {
            if (limitMatch[1] !== "None") type.maximum = parseInt(limitMatch[1]);
            if (limitMatch[3] !== "None") type.default = parseInt(limitMatch[3]);
            parameter.help_text = parameter.help_text.replace(limitMatch[0], "");
        }

        if (doc_type === "numeric, list") {
            let res: OpenAPI.Schema = { type: "array", items: type };

            if (required) res.minItems = 1;

            let maxMatch = help_text.match(/Maximum limit: (\d+)\./);

            if (maxMatch?.length === 2) {
                res.maxItems = parseInt(maxMatch[1])
                parameter.help_text = parameter.help_text.replace(maxMatch[0], "");
            }

            return res;
        }
        else {
            return type;
        }
    }
    if (doc_type.startsWith("string")) {
        let type: OpenAPI.Schema = { type: "string" };

        if (validValues.length > 0) type.enum = validValues.map(value => value.replace(/\"/g, "").trim());
        if (validValuesDescription.length > 0) type["x-enumDescriptions"] = validValuesDescription.map(description => description.trim());

        let defaultMatch = help_text.match(/Default is \"(.+)\"\./);

        if (doc_type === "string, list") {
            let res: OpenAPI.Schema = { type: "array", items: type };

            if (defaultMatch?.length === 2) {
                res.default = defaultMatch[1].split(",").map(s => s.trim());
                parameter.help_text = parameter.help_text.replace(defaultMatch[0], "");
            }

            if (required) res.minItems = 1;

            let maxMatch = help_text.match(/Maximum limit: (\d+)\./);

            if (maxMatch?.length === 2) {
                res.maxItems = parseInt(maxMatch[1])
                parameter.help_text = parameter.help_text.replace(maxMatch[0], "");
            }

            return res;
        }
        else {
            if (defaultMatch?.length === 2) {
                type.default = defaultMatch[1]
                parameter.help_text = parameter.help_text.replace(defaultMatch[0], "");
            }

            return type;
        }
    }

    if (doc_type === "timestamp/date") return {
        oneOf: [{
            type: "integer"
        }, {
            type: "string",
            format: "date-time"
        }]
    }

    throw new Error(`Unknown type: ${doc_type}`);
}

function assertTests(tests: any[], type: any, value: OpenAPI.Schema) {
    let nullable = false;

    for (let test of tests) {
        if (test === null) nullable = true;
        else if (typeof test !== type) throw new Error(type);
    }

    if (nullable) value.nullable = true;

    return value;
}

function guessTypes(tests: any[]): [boolean, Map<(OpenAPI.Schema["type"]), any[]>] {
    let testsNotNull = tests.filter(test => test !== null);

    return [testsNotNull.length < tests.length, testsNotNull.reduce((map, test) => {
        let type = Array.isArray(test) ? "array" : typeof test;

        if (!map.has(type)) {
            map.set(type, []);
        }

        map.get(type)!.push(test);

        return map;
    }, new Map() as Map<string, any[]>)];
}

function inferSchemaRec(type: OpenAPI.Schema["type"], tests: any[]): OpenAPI.Schema {
    if (type === "array") {
        return {
            type: "array",
            items: inferSchema((tests as any[][]).reduce((tests, test) => [...test, ...tests], []))
        }
    }
    else if (type === "object") {
        return {
            type: "object",
            additionalProperties: inferSchema((tests as any[]).reduce((tests, test) => [...Object.values(test), ...tests], []))
        }
    }
    else {
        return {
            type
        }
    }
}

function inferSchema(tests: any[]): OpenAPI.Schema {
    let [nullable, types] = guessTypes(tests);

    if (types.size > 0) {
        if (types.size > 1) {
            let res: OpenAPI.Schema = {
                oneOf: [...types.entries()].map(([type, tests2]) => inferSchemaRec(type, tests2))
            }

            if (nullable) res.nullable = nullable;

            return res;
        }
        else {
            let [[type, tests2]] = [...types.entries()] as [OpenAPI.Schema["type"], any[]][];

            let res = inferSchemaRec(type, tests2);

            if (nullable) res.nullable = nullable;

            return res;
        }
    }
    else {
        throw new Error("tests required to infer type");
    }
}

function convertField(doc_type: Primitive["doc_type"], tests: any[]): OpenAPI.Schema {
    let isList = doc_type.match(/list of (.+)/);

    if (isList) {
        let testsNotNull = tests.filter(test => test !== null);

        if (testsNotNull.every(test => Array.isArray(test))) {
            let types: Record<string, Primitive["doc_type"]> = {
                integers: "numeric",
                strings: "string",
                booleans: "boolean",
                timestamps: "timestamp",
                floats: "float"
            }

            let type = types[isList[1]];

            if (type) {
                let extendedTests = testsNotNull.reduce((tests, test) => [...test, ...tests], []);

                let res: OpenAPI.Schema = { type: "array", items: convertField(type, extendedTests) }

                if (testsNotNull.length < tests.length) res.nullable = true;

                return res;
            }
            else {
                throw new Error("Unexpected list type");
            }
        }
        else {
            throw new Error("Incompatible");
        }
    }
    else {
        switch (doc_type) {
            case "timestamp":
            case "numeric":
                return assertTests(tests, "number", { type: "integer" });
            case "float":
                return assertTests(tests, "number", { type: "number", format: "float" });
            case "string":
                return assertTests(tests, "string", { type: "string" });
            case "boolean":
                return assertTests(tests, "boolean", { type: "boolean" });
            case "associative array": {
                let testsNotNull = tests.filter(test => test !== null);

                let res: OpenAPI.Schema = {
                    type: "object",
                    additionalProperties: inferSchema(testsNotNull.reduce((tests, test) => [...Object.values(test), ...tests], []))
                }

                if (testsNotNull.length < tests.length) res.nullable = true;

                return res;

                /*let [nullable, types] = guessTypes(tests.reduce((tests, test) => test !== null ? [...Object.values(test), ...tests] : tests, []))

                if (types.size > 1) {
                    throw new Error("to much types");
                }
                else {
                    let res: OpenAPI.Schema = { type: "object" };

                    if (types.has("null")) {
                        res.nullable = true;
                        types.delete("null");
                    }

                    let [[type, tests2]] = [...types.entries()] as [OpenAPI.Schema["type"], any[]][];

                    if (type === "array") {
                        let types = guessTypes(tests2.reduce((tests, test) => test !== null ? [...test, ...tests] : tests, []))

                        let res2: OpenAPI.Schema = { type: "object" };

                        if (types.has("null")) {
                            res.nullable = true;
                            types.delete("null");
                        }

                        let [[type, tests3]] = [...types.entries()] as [OpenAPI.Schema["type"], any[]][];
                    }
                    else {
                        res.additionalProperties = { type }
                    }
                }*/
            }
            case "object":
                return { type: "object" };
            default:
                throw new Error(`Unknown doc_type: ${doc_type}`);
        }
    }
}

function convertGroup(group: Group, tests: any[]): OpenAPI.Schema {
    let testsNotNull = tests.filter(test => test !== null);

    let nullable = testsNotNull.length < tests.length;

    let partial_match = false;

    let types = testsNotNull.reduce((map: Map<"array" | "object" | "record", any[]>, test) => {
        if (Array.isArray(test)) {
            if (!map.has("array")) {
                map.set("array", []);
            }

            map.get("array")!.push(test);

            return map;
        }
        else {
            if (typeof test === "object") {
                if (group.fields.every(field => field.name in test)
                    || (group.fields.some(field => field.name in test) && !Object.values(test).every(value => group.fields.every(field => typeof value === "object" && (value == null || field.name in value))))) {

                    if (!group.fields.every(field => field.name in test)) partial_match = true;

                    if (!map.has("object")) {
                        map.set("object", []);
                    }

                    map.get("object")!.push(test);

                    return map;

                }
                else {
                    if (!map.has("record")) {
                        map.set("record", []);
                    }

                    map.get("record")!.push(test);

                    return map;

                }
            }
            else throw new Error(`Expected: object. Got: ${typeof test}.`);
        }
    }, new Map() as Map<"array" | "object" | "record", any[]>);

    if (partial_match) console.warn(`Partial group match: "${group.help_text}".`);

    const to = {
        object(tests: any[]) {
            let [permaFields, extraFields] = group.fields.reduce(([perma, extra], field) => field.help_text.includes("**An extra field.**") ? [perma, [field, ...extra]] : [[field, ...perma], extra], [[], []] as [(Primitive | Group)[], (Primitive | Group)[]]);

            extraFields.forEach(field => {
                field.help_text = field.help_text.replace("**An extra field.**", "").trim();
            });

            let res: OpenAPI.Schema = {
                type: "object",
                properties: Object.fromEntries(group.fields.map(field => convertDataFields(field, tests.filter(test => test[field.name] !== undefined).map(test => test[field.name]))))
            }

            if (permaFields.length > 0) res.required = permaFields.map(field => field.name)
            if (nullable) res.nullable = true;

            return res;
        },
        array(tests: any[]) {
            let res: OpenAPI.Schema = {
                type: "array",
                items: convertGroup(group, tests.reduce((tests, test) => [...test, ...tests], []))
            }

            if (nullable) res.nullable = true;

            return res;
        },
        record(tests: any[]) {
            let res: OpenAPI.Schema = {
                type: "object",
                additionalProperties: convertGroup(group, tests.reduce((tests, test) => [...Object.values(test), ...tests], []))
            }

            if (nullable) res.nullable = true;

            return res;
        }
    }

    if (types.size === 0) {
        types.set("object", []);

        console.warn(`Not enough tests to infer type of group "${group.help_text}": "object" is used instead.`);
    }

    if (types.size > 1) {
        return {
            oneOf: [...types.entries()].map(([type, tests2]) => to[type](tests2))
        }
    }
    else {
        let [type, tests2] = [...types.entries()][0];

        return to[type](tests2);
    }
}

function fixDescription(description: string) {
    return description.replace("](/", "](https://developers.wargaming.net/").trim()
}

function convertDataFields(obj: Primitive | Group, tests: any[]): [string, OpenAPI.Schema] {
    return [obj.name, { description: obj.help_text, ...("fields" in obj ? convertGroup(obj, tests) : convertField(obj.doc_type, tests)) }];
}

export function convertParameter(parameter: Parameter): OpenAPI.Parameter {
    let schema = convertParameterType(parameter);

    let res: OpenAPI.Parameter = {
        name: parameter.name,
        description: fixDescription(parameter.help_text),
        in: "query",
        schema
    }

    if (parameter.required) res.required = true;
    if (parameter.deprecated) res.deprecated = true;
    if ("type" in res.schema && res.schema.type === "array") {
        res.style = "form";
        res.explode = false;
    }

    return res;
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
                data: convertDataFields({
                    "help_text": method.description,
                    "fields": method.output_form_info?.fields ?? [],
                    "deprecated_text": method.output_form_info?.deprecated_text ?? "",
                    "name": method.name,
                    "deprecated": method.output_form_info?.deprecated ?? false
                }, tests.map(test => test.data))[1]
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

    let response = {
        "200": {
            description: "OK",
            content: {
                "application/json": {
                    "schema": schema
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
                else return convertParameter(parameter)
            }),
            responses: response,
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
            operationId: ["post", ...methodKey.slice(1)].join("_"),
            requestBody: {
                required: true,
                content: {
                    "application/x-www-form-urlencoded": {
                        schema: {
                            type: "object",
                            properties: Object.fromEntries(method.input_form_info.fields.filter(parameter => parameter.name !== "application_id").sort(sortParameters).map(parameter => [parameter.name, { description: fixDescription(parameter.help_text), ...convertParameterType(parameter) }])),
                            required: method.input_form_info.fields.filter(parameter => parameter.required).map(parameter => parameter.name)
                        }
                    }
                }
            },
            responses: response,
            tags: [method.category_name],
            externalDocs: {
                url: `https://developers.wargaming.net/reference/all/${methodKey[0]}/${methodKey[1]}/${methodKey[2]}/`
            }
        }
    }

    return [getPath(method.method_key), pathItem];
}

export function convertGame(game: Game, servers: OpenAPI.Server[], parameters: Record<string, OpenAPI.Parameter>): OpenAPI.OpenAPI {
    return {
        openapi: "3.0.0",
        info: {
            title: game.long_name,
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

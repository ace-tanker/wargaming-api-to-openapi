import type * as API from "./api.mjs";
import type * as OpenAPI from "./openapi.mjs";

import * as Converter from "./converter.mjs";

import fs from "fs";
import path from "path";

function readGameJSON(path: string) {
    let file = fs.readFileSync(path, { encoding: "utf-8" });

    return JSON.parse(file) as API.Game;
}

function writeGameOpenAPI(input: string, output: string) {
    let gameJSON = readGameJSON(input);

    let openAPI = Converter.convertGame(gameJSON, { servers: servers[gameJSON.name] as [], parameters: parameters[gameJSON.name] ?? {}, filterMethod, getTests });

    fs.writeFileSync(output, JSON.stringify(openAPI), { encoding: "utf8" });
}

let servers: Record<string, OpenAPI.Server[]> = {
    wot: [{
        url: "https://api.worldoftanks.eu/wot",
        description: "Europe"
    },
    {
        url: "https://api.worldoftanks.com/wot",
        description: "North America"
    },
    {
        url: "https://api.worldoftanks.asia/wot",
        description: "Asia"
    },
    {
        url: "https://api.tanki.su/wot",
        description: "CIS"
    },
    {
        url: "https://api.wotgame.cn/wot",
        description: "China"
    }]
}

let parameters: Record<string, Record<string, OpenAPI.Parameter>> = {
    wot: {
        fields: {
            "name": "fields",
            "description": "Response field. Embedded fields are separated with dots. To exclude a field, use “-” in front of its name. In case the parameter is not defined, the method returns all fields.",
            "in": "query",
            "style": "form",
            "explode": false,
            "schema": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                minItems: 0,
                maxItems: 100,
                default: []
            }
        },
        encyclopedia_language: {
            "name": "language",
            "description": "Localization language.",
            "in": "query",
            "style": "form",
            "explode": false,
            "schema": {
                "type": "string",
                "enum": [
                    "en",
                    "ru",
                    "pl",
                    "de",
                    "fr",
                    "es",
                    "zh-cn",
                    "zh-tw",
                    "tr",
                    "cs",
                    "th",
                    "vi",
                    "ko"
                ],
                "x-enumDescriptions": [
                    "English",
                    "Russian",
                    "Polish",
                    "German",
                    "French",
                    "Spanish",
                    "Chinese Simplified",
                    "Chinese Traditional",
                    "Turkish",
                    "Czech",
                    "Thai",
                    "Vietnamese",
                    "Korean"
                ]
            }
        },
        stronghold_language: {
            "name": "language",
            "description": "Localization language.",
            "in": "query",
            "schema": {
                "type": "string",
                "enum": ["en", "de", "pl", "fr", "es", "cs", "tr", "es-ar", "pt-br", "ja", "vi", "th", "ko"],
                "x-enumDescriptions": ["English", "German", "Polish", "French", "Spanish", "Czech", "Turkish", "Argentinian Spanish", "Brazilian Portuguese", "Japanese", "Vietnamese", "Thai", "Korean"]
            }
        },
        globalmap_language: {
            "name": "language",
            "description": "Language.",
            "in": "query",
            "schema": {
                "type": "string",
                "enum": ["en", "de", "fr", "es", "pl", "tr", "th"],
                "x-enumDescriptions": ["English", "German", "French", "Spanish", "Polish", "Turkish", "Thai"]
            }
        },
        clans_language: {
            "name": "language",
            "description": "Localization language.",
            "in": "query",
            "style": "form",
            "explode": false,
            "schema": {
                "type": "string",
                "enum": [
                    "en",
                    "ru",
                    "pl",
                    "de",
                    "fr",
                    "es",
                    "zh-cn",
                    "zh-tw",
                    "tr",
                    "cs",
                    "th",
                    "vi",
                    "ko"
                ],
                "x-enumDescriptions": [
                    "English",
                    "Russian",
                    "Polish",
                    "German",
                    "French",
                    "Spanish",
                    "Chinese Simplified",
                    "Chinese Traditional",
                    "Turkish",
                    "Czech",
                    "Thai",
                    "Vietnamese",
                    "Korean"
                ]
            }
        }
    }
}

function getTests({ method_key }: API.Method): any[] {
    const folderPath = `tests/${method_key.split("_").join("/")}`;
    const jsonFiles = fs.readdirSync(folderPath).filter(file => file.endsWith(".json"));

    return jsonFiles.map(file => {
        const content = fs.readFileSync(path.join(folderPath, file), "utf-8");
        return JSON.parse(content);
    });
}


function filterMethod(method: API.Method) {
    if (method.deprecated) {
        console.warn(`Method deprecated ignored: ${method.method_key}.`);

        return false;
    }

    if (fs.existsSync(`tests/${method.method_key.split("_").join("/")}`)) return true;
    else {
        console.warn(`Tests not found, method ignored: ${method.method_key}.`);

        return false;
    }
}

let game = "wot";
let region = "eu";
let input = `./reference/${game}/${region}.json`;
let output = `./openapi/${game}.json`;

writeGameOpenAPI(input, output);

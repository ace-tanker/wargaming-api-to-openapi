import type * as API from "./api.mjs";
import type * as OpenAPI from "./openapi.mjs";

import * as Converter from "./converter.mjs";

import fs from "fs";

function readGameJSON(path: string) {
    let file = fs.readFileSync(path, { encoding: "utf-8" });

    return JSON.parse(file) as API.Game;
}

function writeGameOpenAPI(input: string, output: string) {
    let gameJSON = readGameJSON(input);

    let openAPI = Converter.convertGame(gameJSON, servers[gameJSON.name] as []);

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

let game = "wot";
let region = "eu";
let input = `./reference/${game}/${region}.json`;
let output = `./openapi/${game}.json`;

writeGameOpenAPI(input, output);

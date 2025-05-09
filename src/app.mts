import type * as API from "./api.mjs";
import * as OpenAPI from "./converter.mjs";

import fs from "fs";

function readGameJSON(path: string) {
    let file = fs.readFileSync(path, { encoding: "utf-8" });

    return JSON.parse(file) as API.Game;
}

function writeGameOpenAPI(input: string, output: string) {
    let gameJSON = readGameJSON(input);

    let openAPI = OpenAPI.convertGame(gameJSON);

    fs.writeFileSync(output, JSON.stringify(openAPI), { encoding: "utf8" });
}

let game = "wot";
let region = "eu";
let input = `./reference/${game}/${region}.json`;
let output = `./openapi/${game}.json`;

writeGameOpenAPI(input, output);

export type Field = {
    "name": string,
    "help_text": string,
    "deprecated": boolean,
    "deprecated_text": string,

    "required": true,
    "doc_type": string
}

export type Group = {
    "name": string,
    "help_text": string,
    "deprecated": boolean,
    "deprecated_text": string,

    "fields": (Field | Group)[]
}

export type Parameter = {
    "doc_type": string,
    "name": string,
    "deprecated": boolean,
    "required": boolean,
    "help_text": string,
    "deprecated_text": string
}

export type Error = [number, string, string];

export type Protocol = "http" | "https";
export type HTTPMethod = "GET" | "POST";

export type Method = {
    "method_key": string,
    "category_name": string,
    "errors": Error[],
    "name": string,
    "url": string,
    "deprecated": boolean,
    "allowed_protocols": Protocol[],
    "output_form_info": {
        "help_text": string,
        "fields": (Field | Group)[],
        "deprecated_text": string,
        "name": string,
        "deprecated": boolean
    } | null,
    "input_form_info": {
        "help_text": string,
        "fields": Parameter[],
        "deprecated_text": string,
        "name": string,
        "deprecated": boolean
    },
    "allowed_http_methods": HTTPMethod[],
    "description": string
};

export type Game = {
    "long_name": string,
    "category_names": { [category: string]: string },
    "methods": Method[],
    "name": string,
}

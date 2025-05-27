export type Primitive = {
    "name": "string"
    "help_text": string
    "required": boolean
    "doc_type": "numeric" | "float" | "string" | "boolean" | "timestamp" | "associative array" | "object" | "list of integers" | "list of floats" | "list of strings" | "list of booleans" | "list of timestamps"
    "deprecated": boolean
    "deprecated_text": string
}

export type Group = {
    "name": string
    "help_text": string
    "deprecated": boolean
    "deprecated_text": string
    "fields": Field[]
}

export type Field = Primitive | Group

export type Parameter = {
    "name": string
    "help_text": string
    "required": boolean
    "doc_type": "numeric" | "numeric, list" | "string" | "string, list" | "timestamp/date"
    "deprecated": boolean
    "deprecated_text": string
}

export type Error = [number, string, string];

export type Protocol = "http" | "https";

export type HTTPMethod = "GET" | "POST";

export type Method = {
    "name": string
    "description": string
    "method_key": string
    "category_name": string
    "errors": Error[]
    "url": string
    "deprecated": boolean
    "allowed_protocols": Protocol[]
    "output_form_info": Group | null
    "input_form_info": {
        "help_text": string
        "fields": Parameter[]
        "deprecated_text": string
        "name": string
        "deprecated": boolean
    }
    "allowed_http_methods": HTTPMethod[]
};

export type Game = {
    "long_name": string,
    "category_names": { [category: string]: string },
    "methods": Method[],
    "name": string,
}

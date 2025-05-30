export type GameID = string
export type CategoryID = string
export type MethodID = string

export type Primitive = {
    name: string
    help_text: string
    required: boolean
    doc_type: "numeric" | "float" | "string" | "boolean" | "timestamp" | "associative array" | "object" | "list of integers" | "list of floats" | "list of strings" | "list of booleans" | "list of timestamps"
    deprecated: boolean
    deprecated_text: string
}

export type Group = {
    name: string
    help_text: string
    deprecated: boolean
    deprecated_text: string
    fields: Field[]
}

export type Field = Primitive | Group

export type Parameter = {
    name: string
    help_text: string
    required: boolean
    doc_type: "numeric" | "numeric, list" | "string" | "string, list" | "timestamp/date"
    deprecated: boolean
    deprecated_text: string
}

export type Error = [number, string, string];

export type Protocol = "http" | "https";

export type HTTPMethod = "GET" | "POST";

export type Method = {
    name: string
    description: string
    method_key: `${GameID}_${CategoryID}_${MethodID}`
    category_name: string
    errors: Error[]
    url: `${CategoryID}/${string}`
    deprecated: boolean
    allowed_protocols: Protocol[]
    output_form_info: {
        name: ""
        help_text: ""
        deprecated: false
        deprecated_text: ""
        fields: Field[]
    } | null
    input_form_info: {
        name: ""
        help_text: ""
        deprecated: false
        deprecated_text: ""
        fields: Parameter[]
    }
    allowed_http_methods: HTTPMethod[]
};

export type Game = {
    name: GameID
    long_name: string
    category_names: { [category: CategoryID]: string }
    methods: Method[]
}

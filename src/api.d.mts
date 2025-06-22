/**
 * Unique identifier for a game.
 */
export type GameID = string

/**
 * Unique identifier for a category.
 */
export type CategoryID = string

/**
 * Unique identifier for a method.
 */
export type MethodID = string

/**
 * Represents a base interface for Primitive, Group and Parameter.
 */
export interface Base {
    /** Name of the field. */
    name: string
    /** Description of the field. */
    help_text: string
    /** Indicates if the field is deprecated. */
    deprecated: boolean
    /** Description of deprecation, if applicable. */
    deprecated_text: string
}

/**
 * Represents a parameter for a method.
 */
export interface Parameter extends Base {
    /** Indicates if the parameter is required. */
    required: boolean
    /** Data type of the parameter. */
    doc_type: "numeric" | "numeric, list" | "string" | "string, list" | "timestamp/date"
}

export interface InputFormInfo extends Base {
    /** List of parameters in the input form. */
    fields: Parameter[]
}

/**
 * Represents a primitive field in a response.
 */
export interface Primitive extends Base {
    /** Data type of the field. */
    doc_type: "numeric" | "float" | "string" | "boolean" | "timestamp" | "associative array" | "object" | "list of integers" | "list of floats" | "list of strings" | "list of booleans" | "list of timestamps"
    /** Indicates if the field is required. */
    required: boolean
}

/**
 * Represents a group of fields, which can include primitives or other groups.
 */
export interface Group extends Base {
    /** List of fields in the group. */
    fields: Field[]
}

/**
 * Represents a field, which can be either a Primitive or a Group.
 */
export type Field = Primitive | Group

export interface OutputFormInfo extends Base {
    /** List of fields in the output form. */
    fields: Field[]
}

/**
 * Represents an error as a tuple: [code, message, description].
 */
export type Error = [number, string, string];

/**
 * Supported protocols for API methods.
 */
export type Protocol = "http" | "https";

/**
 * Supported HTTP methods for API methods.
 */
export type HTTPMethod = "GET" | "POST";

/**
 * Represents an API method.
 */
export type Method = {
    /** Name of the method. */
    name: string
    /** Description of the method. */
    description: string
    /** Indicates if the method is deprecated. */
    deprecated: boolean
    /** Unique key for the method, composed of GameID, CategoryID, and MethodID. */
    method_key: `${GameID}_${CategoryID}_${MethodID}`
    /** URL path for the method. */
    url: `${CategoryID}/${MethodID}`
    /** Name of the category this method belongs to. */
    category_name: string
    /** List of allowed protocols for this method. */
    allowed_protocols: Protocol[]
    /** List of allowed HTTP methods for this method. */
    allowed_http_methods: HTTPMethod[]
    /** Parameters. */
    input_form_info: InputFormInfo
    /** Response. */
    output_form_info: OutputFormInfo | null
    /** Errors. */
    errors: Error[]
};

/**
 * Represents a Wargaming.net Public API game specification.
 */
export type Game = {
    /** Game identifier. */
    name: GameID
    /** Full name of the game. */
    long_name: string | null
    /** Mapping of category IDs to category names. */
    category_names: { [category: CategoryID]: string }
    /** List of methods available for the game. */
    methods: Method[]
}

import { JSONSchema7 } from "json-schema";

export interface Schema extends JSONSchema7 {
    nullable?: boolean;
    "x-enumDescriptions"?: string[];
    discriminator?: {
        propertyName: string;
        mapping?: Record<string, string>;
    };
}

export interface OpenAPI {
    openapi: string;
    info: Info;
    jsonSchemaDialect?: string;
    servers?: Server[];
    webhooks?: Record<string, PathItem>;
    components?: Components;
    security?: SecurityRequirement[];
    tags?: Tag[];
    externalDocs?: ExternalDocumentation;
    paths: { [path: string]: PathItem }
}

export interface Info {
    title: string;
    summary?: string;
    description?: string;
    termsOfService?: string;
    contact?: Contact;
    license?: License;
    version: string;
}

export interface Contact {
    name?: string;
    url?: string;
    email?: string;
}

export interface License {
    name: string;
    identifier?: string;
    url?: string;
}

export interface Server {
    url: string;
    description?: string;
    variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
    enum?: string[];
    default: string;
    description?: string;
}

export interface Components {
    schemas?: Record<string, Schema>;
    responses?: Record<string, Response>;
    parameters?: Record<string, Parameter>;
    examples?: Record<string, Example>;
    requestBodies?: Record<string, RequestBody>;
    headers?: Record<string, Header>;
    securitySchemes?: Record<string, SecurityScheme>;
    links?: Record<string, Link>;
    callbacks?: Record<string, Callback>;
}

export interface SecurityRequirement {
    [key: string]: string[];
}

export interface Tag {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
}

export interface ExternalDocumentation {
    description?: string;
    url: string;
}

export interface PathItem {
    summary?: string;
    description?: string;
    parameters?: (Parameter | Reference)[];
    get?: Operation;
    post?: Operation;
    put?: Operation;
    delete?: Operation;
    patch?: Operation;
}

export interface Parameter {
    name: string;
    description?: string;
    deprecated?: boolean;
    in: "query" | "header" | "path" | "cookie";
    required?: boolean;
    schema: (Schema | Reference);
    allowEmptyValue?: boolean;
    style?: string;
    explode?: boolean;
    default?: any
}
export interface Operation {
    operationId?: string;
    summary?: string;
    description?: string;
    security?: Record<string, string[]>[]
    parameters?: (Parameter | Reference)[];
    responses: Record<string, Response | Reference>;
    tags: string[]
    requestBody?: RequestBody
    externalDocs?: ExternalDocumentation;
}

export interface RequestBody {
    descreiption?: string
    required?: boolean
    content: Record<string, MediaType>
}

export interface Response {
    description: string;
    content?: Record<string, MediaType | Reference>;
}

export interface MediaType {
    schema: (Schema | Reference);
}

export interface Reference {
    "$ref": string;
}


/**
 * This file exposes types and methods for API responses.
 */

import type * as API from "./api.mjs"

export type Integer = number
export type Boolean = boolean
export type Timestamp = number
export type Float = number
export type String = string
export type Null = null
export type Array = Group[]
export type Object = { [key: string]: Field }
export type Record = { [key: string]: Group }
export type Group = Object | Array | Record | Null
export type AssociativeArray = { [key: string]: Primitive }
export type List = Primitive[]
export type Primitive = String | Integer | Timestamp | Boolean | Null | AssociativeArray | List
export type Field = Group | Primitive

function isBoolean(value: unknown): value is Boolean {
    return typeof value === "boolean";
}

function isString(value: unknown): value is String {
    return typeof value === "string";
}

function isFloat(value: unknown): value is Float {
    return typeof value === "number";
}

function isInteger(value: unknown): value is Integer {
    return Number.isInteger(value);
}

function isTimestamp(value: unknown): value is Timestamp {
    return Number.isInteger(value) && (value as number) >= 0;
}

function isPrimitive(value: unknown, primitive: API.Primitive): value is Primitive {
    if (value === null) return true;

    switch (primitive.doc_type) {
        case "string": return isString(value);
        case "float": return isFloat(value);
        case "numeric": return isInteger(value);
        case "boolean": return isBoolean(value);
        case "timestamp": return isTimestamp(value);
        case "object": return typeof value === "object";
        case "associative array": return typeof value === "object";
        case "list of booleans": return Array.isArray(value) && value.every(value => isBoolean(value));
        case "list of integers": return Array.isArray(value) && value.every(value => isInteger(value));
        case "list of strings": return Array.isArray(value) && value.every(value => isString(value));
        case "list of floats": return Array.isArray(value) && value.every(value => isFloat(value));
        case "list of timestamps": return Array.isArray(value) && value.every(value => isTimestamp(value));
    }
}

// Test < Schema
export function isObjectGroup(value: unknown, { fields }: API.Group): value is Object {
    return value !== null && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(([key, value]) => {
        const field = fields.find(field => field.name === key);

        return field !== undefined && isField(value, field);
    });
}

// Test > Schema
export function isExtendedObjectGroup(value: unknown, { fields }: API.Group): value is Object {
    return value !== null && typeof value === "object" && !Array.isArray(value) && fields.every(field => field.name in value && isField((value as Object)[field.name], field));
}

export function isRecordGroup(value: unknown, group: API.Group): value is Record {
    return value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(value => isGroup(value, group));
}

export function isArrayGroup(value: unknown, group: API.Group): value is Array {
    return Array.isArray(value) && value.every(value => isGroup(value, group));
}

export function isGroup(value: unknown, group: API.Group): value is Group {
    return value === null || isArrayGroup(value, group) || isObjectGroup(value, group) || isRecordGroup(value, group);
}

export function isField(value: unknown, field: API.Field): value is Field {
    return "fields" in field ? isGroup(value, field) : isPrimitive(value, field);
}

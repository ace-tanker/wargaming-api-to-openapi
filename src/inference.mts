import { JSONSchema7 as Schema } from "json-schema"

export type JSONNull = null
export type JSONString = string
export type JSONNumber = number
export type JSONBoolean = boolean
export type JSONArray = JSON[]
export type JSONObject = { [key: string]: JSON }
export type JSON = JSONNull | JSONString | JSONNumber | JSONBoolean | JSONArray | JSONObject

export function inferNumber(values: JSONNumber[]): Schema {
    const isInteger = values.every(n => Number.isInteger(n));

    if (isInteger) {
        return { type: "integer" };
    }
    else {
        return { type: "number" };
    }
}

export function inferArray(values: JSONArray[]): Schema {
    return {
        type: "array",
        items: inferJSON(values.reduce((values, value) => [...value, ...values], []))
    }
}

export function inferObject(values: JSONObject[]): Schema {
    return {
        type: "object",
        additionalProperties: inferJSON(values.reduce((values2: JSON[], value) => [...Object.values(value), ...values2], []))
    }
}
export function inferNull(values: JSONNull[]): Schema {
    return {
        type: "null"
    }
}

export function inferJSON(values: JSON[]): Schema {
    const stringValues: JSONString[] = []
    const numberValues: JSONNumber[] = []
    const booleanValues: JSONBoolean[] = []
    const arrayValues: JSONArray[] = []
    const objectValues: JSONObject[] = []
    const nullValues: JSONNull[] = []

    for (let value of values) {
        if (value === null) nullValues.push(value);
        else if (typeof value === "string") stringValues.push(value);
        else if (typeof value === "number") numberValues.push(value);
        else if (typeof value === "boolean") booleanValues.push(value);
        else if (Array.isArray(value)) arrayValues.push(value);
        else if (typeof value === "object") objectValues.push(value);
    }

    const oneOf: Schema[] = [];

    if (stringValues.length > 0) oneOf.push({ type: "string" });
    if (numberValues.length > 0) oneOf.push(inferNumber(numberValues));
    if (booleanValues.length > 0) oneOf.push({ type: "boolean" });
    if (arrayValues.length > 0) oneOf.push(inferArray(arrayValues));
    if (objectValues.length > 0) oneOf.push(inferObject(objectValues));
    if (nullValues.length > 0) oneOf.push(inferNull(nullValues));

    return oneOf.length === 0 ? {} : oneOf.length === 1 ? oneOf[0] : { oneOf };
}


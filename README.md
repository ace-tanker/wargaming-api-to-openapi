# wargaming-api-to-openapi
Converts a Wargaming.net Public API specification to OpenAPI 3.0.
## Installation
Clone the project.
## Usage
node ./src/app.mjs
## Project Structure
- `reference/` contains the original Wargaming API specification files for each game.
- `src/` contains the source files used to convert the specification to OpenAPI.
- `tests/` contains the test cases for each API method, organized by game and then by category.
## Tests
The official API reference is incomplete, so real API responses are used to infer:
- which fields may be `null`
- exact types for ambiguous primitives (e.g. "associative array" or "object")
- distinction between `object`, `record`, and `array` groups
All fields including optional ones **should be included** to prevent failures in the inference process.
## Limitations
Some limitations in the generated OpenAPI specification are due to the conversion process and may be fixed manually, while others are inherent to OpenAPI itself.
### Fields
Be careful when using the `fields` parameter:
- allowed values are **not enumerated**
- fields dynamically excluded via `fields` will still appear as **required** in the schema
### Language
The `language` parameter is **region-specific**, refer to the [official reference](https://developers.wargaming.net/reference/) for the list of valid options per region.
### Dynamic Parameters
Some methods allow multiple valid parameter combinations and may require manual adjustment.
> For example, the `Players` method has a `search` parameter whose type depends on the value of `type`.
### Dynamic Responses
Some responses vary depending on the input parameters. Since this is not supported by OpenAPI, such cases are represented as a union of all possible response shapes.
> This currently applies only to the `wot_clans_info` method with the `members_key` parameter.
## Licence
MIT © Ace Tanker

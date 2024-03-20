# Address Tags Query Submodule

This repository contains a TypeScript-based submodule for the Address Tags Query registry. The submodule allows for querying and returning formatted data for various blockchain addresses and their associated metadata tags.

## Prerequisites

- Node.js (recommended version 14 or higher)
- Yarn package manager

## Setup

To set up the submodule for development, follow these steps:

1. Clone the repository:
   ````
   git clone https://github.com/gmkung/atq-sample-submodule```
   ````
2. Navigate into the repository directory:

`cd your-submodule-repo`

Install the dependencies:

`yarn install`

## Development

When developing the submodule, you should adhere to the predefined settings in the `tsconfig.json` and `package.json` files provided in this repository. Please note that no additional packages should be used beyond what is specified within these configuration files.

Your TypeScript files should be written with ESNext modules and saved with the `.mjs` extension. The yarn build command will compile your TypeScript code to the dist directory with the correct `.mjs` extension.

## Building the Submodule

To build the submodule, run the following command:

`yarn build`

This command compiles the TypeScript files to ECMAScript modules in the dist directory.

## Running the Submodule

After building the submodule, you can run it using the following command:

`yarn start`

This command will execute the test script and export a CSV file under /dist/tests with the retrieved address tags (adjust the arguments of `returnTags()` to those that your implementation supports). This script must run successfully.

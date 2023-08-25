"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const graphql_1 = require("@octokit/graphql");
const errors_1 = require("../../src/errors");
const request_error_1 = require("@octokit/request-error");
describe('Errors', () => {
    describe('isOctokitRequestError', () => {
        it('should return true for valid RequestError', () => {
            const error = new request_error_1.RequestError('Not Found', 404, {
                request: { method: 'GET', url: '/foo/bar', headers: {} },
                headers: {},
            });
            (0, chai_1.expect)((0, errors_1.isOctokitRequestError)(error)).to.be.true;
        });
        it('should return false for invalid RequestError', () => {
            const error = {
                name: 'SomeOtherError',
                status: 500,
                request: 'invalid_request_object',
            };
            (0, chai_1.expect)((0, errors_1.isOctokitRequestError)(error)).to.be.false;
        });
    });
    describe('isOctokitGraphqlResponseError', () => {
        it('should return true for valid GraphqlResponseError', () => {
            const error = new graphql_1.GraphqlResponseError({
                method: 'GET',
                url: '/foo/bar',
            }, {}, {
                data: {},
                errors: [
                    {
                        type: 'FORBIDDEN',
                        message: 'Resource not accessible by integration',
                        path: ['foo'],
                        extensions: {},
                        locations: [
                            {
                                line: 123,
                                column: 456,
                            },
                        ],
                    },
                ],
            });
            (0, chai_1.expect)((0, errors_1.isOctokitGraphqlResponseError)(error)).to.be.true;
        });
        it('should return false for invalid GraphqlResponseError', () => {
            const error = {
                request: {},
                headers: {},
                response: {},
                name: 'SomeOtherError',
                errors: [],
            };
            (0, chai_1.expect)((0, errors_1.isOctokitGraphqlResponseError)(error)).to.be.false;
        });
    });
});
//# sourceMappingURL=index.js.map
import { GraphqlResponseError } from '@octokit/graphql';
import { RequestError } from '@octokit/request-error';
import { RequestError as RequestErrorBody } from '@octokit/types';
interface SingleError {
    resource: string;
    code: string;
    field: string;
}
export declare class ConfigurationError extends Error {
    releaserName: string;
    repository: string;
    constructor(message: string, releaserName: string, repository: string);
}
export declare class MissingRequiredFileError extends ConfigurationError {
    file: string;
    constructor(file: string, releaserName: string, repository: string);
}
export declare class GitHubAPIError extends Error {
    body: RequestErrorBody | undefined;
    status: number;
    cause?: Error;
    constructor(requestError: RequestError, message?: string);
    static parseErrorBody(requestError: RequestError): RequestErrorBody | undefined;
    static parseErrors(requestError: RequestError): SingleError[];
}
export declare class AuthError extends GitHubAPIError {
    constructor(requestError: RequestError);
}
export declare class DuplicateReleaseError extends GitHubAPIError {
    tag: string;
    constructor(requestError: RequestError, tag: string);
}
export declare class FileNotFoundError extends Error {
    path: string;
    constructor(path: string);
}
/**
 * Type guard to check if an error is an Octokit RequestError.
 *
 * This function checks the structure of the error object to determine if it matches
 * the shape of a RequestError. It should be favored instead of `instanceof` checks,
 * especially in scenarios where the prototype chain might not be reliable, such as when
 * dealing with different versions of a package or when the error object might have been
 * modified.
 *
 * @param error The error object to check.
 * @returns A boolean indicating whether the error is a RequestError.
 */
export declare function isOctokitRequestError(error: unknown): error is RequestError;
/**
 * Type guard to check if an error is an Octokit GraphqlResponseError.
 *
 * This function checks the structure of the error object to determine if it matches
 * the shape of a GraphqlResponseError. It should be favored instead of `instanceof` checks,
 * especially in scenarios where the prototype chain might not be reliable, such as when
 * dealing with different versions of a package or when the error object might have been
 * modified.
 *
 * @param error The error object to check.
 * @returns A boolean indicating whether the error is a GraphqlResponseError.
 */
export declare function isOctokitGraphqlResponseError(error: unknown): error is GraphqlResponseError<unknown>;
export declare class AggregateError extends Error {
    errors: Error[];
    constructor(errors: Error[], message?: string);
}
export {};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpServer = void 0;
const default_1 = require("../default");
const logger_1 = require("../../util/logger");
/**
 * This updates an MCP server's version
 */
class McpServer extends default_1.DefaultUpdater {
    /**
     * Given initial file contents, return updated contents.
     * @param {string} content The initial content
     * @returns {string} The updated content
     */
    updateContent(content, logger = logger_1.logger) {
        logger.info(`updating to ${this.version}`);
        return content.replace(/version: '.*'/, `version: '${this.version}'`);
    }
}
exports.McpServer = McpServer;
//# sourceMappingURL=mcp-server.js.map
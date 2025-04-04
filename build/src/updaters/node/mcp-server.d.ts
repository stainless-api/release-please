import { DefaultUpdater } from '../default';
import { Logger } from '../../util/logger';
/**
 * This updates an MCP server's version
 */
export declare class McpServer extends DefaultUpdater {
    /**
     * Given initial file contents, return updated contents.
     * @param {string} content The initial content
     * @returns {string} The updated content
     */
    updateContent(content: string, logger?: Logger): string;
}

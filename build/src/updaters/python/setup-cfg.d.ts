import { DefaultUpdater } from '../default';
/**
 * Updates a setup.cfg file
 */
export declare class SetupCfg extends DefaultUpdater {
    /**
     * Given initial file contents, return updated contents.
     * @param {string} content The initial content
     * @returns {string} The updated content
     */
    updateContent(content: string): string;
}
import { DefaultUpdater } from '../default';
/**
 * Updates a README.md file
 */
export declare class PythonReadme extends DefaultUpdater {
    /**
     * Given initial file contents, return updated contents.
     * @param {string} content The initial content
     * @returns {string} The updated content
     */
    updateContent(content: string): string;
}

import {DefaultUpdater} from '../default';

/**
 * Updates a README.md file
 */
export class PythonReadme extends DefaultUpdater {
  /**
   * Given initial file contents, return updated contents.
   * @param {string} content The initial content
   * @returns {string} The updated content
   */
  updateContent(content: string): string {
    if (this.version.preRelease) {
      // it's a pre-release, so add the pre-release flag if it's missing
      return content.replace(
        /^# install from PyPI\n^pip install (\S+)$/gm,
        '# install from PyPI\npip install --pre $1'
      );
    } else {
      // it's not a pre-release, so remove the pre-release flag if it's present
      return content.replace(
        /^# install from PyPI\n^pip install --pre (\S+)$/gm,
        '# install from PyPI\npip install $1'
      );
    }
  }
}

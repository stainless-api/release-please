"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RubyReadMeUpdater = void 0;
const default_1 = require("../default");
const common_1 = require("./common");
const RUBY_VERSION_LINE_REGEX = new RegExp(`(^gem "[^"]+"\\s*,\\s*"[^\\d]+)(${common_1.RUBY_VERSION_REGEX.source})(.)\\s*$`, 'gm');
/**
 * Updates a versions.rb file which is expected to have a version string.
 */
class RubyReadMeUpdater extends default_1.DefaultUpdater {
    /**
     * Given initial file contents, return updated contents.
     * @param {string} content The initial content
     * @returns {string} The updated content
     */
    updateContent(content) {
        return content.replace(RUBY_VERSION_LINE_REGEX, `$1${(0, common_1.stringifyRubyVersion)(this.version)}"`);
    }
}
exports.RubyReadMeUpdater = RubyReadMeUpdater;
//# sourceMappingURL=readme.js.map
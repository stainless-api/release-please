// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {readFileSync} from 'fs';
import {resolve} from 'path';
import snapshot = require('snap-shot-it');
import {describe, it} from 'mocha';
import {ReadMe} from '../../src/updaters/terraform/readme';
import {Version} from '../../src/version';

const fixturesPath = './test/updaters/fixtures';

describe('README.md', () => {
  describe('updateContent', () => {
    it('updates version in README.md', async () => {
      const oldContent = readFileSync(
        resolve(fixturesPath, './README.md'),
        'utf8'
      ).replace(/\r\n/g, '\n');
      const version = new ReadMe({
        version: Version.parse('2.1.0'),
      });
      const newContent = version.updateContent(oldContent);
      snapshot(newContent);
    });
  });
});

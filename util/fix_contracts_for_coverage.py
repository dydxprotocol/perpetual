#!/usr/bin/env python
"""
Copyright 2020 dYdX Trading Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import sys
import string
import os
import glob

# overwrite a single file, fixing the assert lines
def hideAsserts(dir, filepath):
    allLines = []
    numAssertsChanged = 0
    inAnAssert = False
    # parse entire file
    for line in open(filepath, 'r').readlines():
        builder = line.rstrip()
        assertToSkip = line.lstrip().startswith('assert(') and ('coverage-enable-line' not in line)
        explicitToSkip = 'coverage-disable-line' in line
        if assertToSkip or explicitToSkip:
            inAnAssert = True
            numAssertsChanged += 1
            spacesToAdd = len(builder) - len(builder.lstrip()) - 2
            builder = ' ' * spacesToAdd + '/*' + builder.lstrip()

        indexOfEnd = builder.find(');')
        if (inAnAssert and indexOfEnd >= 0):
            inAnAssert = False
            loc = indexOfEnd + 2
            builder = builder[:loc] + '*/' + builder[loc:]

        builder += '\n'
        allLines.append(builder)

    with open(filepath, 'w') as output:
        output.writelines(allLines)

    return numAssertsChanged


def fixRequires(dir, filepath):
    oldRequire = 'Require.that('
    allLines = []
    numRequiresChanged = 0
    inARequire = False
    inMessage = False
    ifStatement = ''
    lineNumber = 0
    # parse entire file
    for line in open(filepath, 'r').readlines():
        builder = line.rstrip()

        # Special case for Test_Lib.sol.
        indexOfRevertString = builder.find('"') if builder.find('"') >= 0 else builder.find('requireReason,')
        if inARequire and indexOfRevertString >= 0:
            inMessage = True

        if inARequire and not inMessage:
            ifStatement += builder.lstrip()

        indexOfOldRequire = line.find(oldRequire)
        if not inARequire and indexOfOldRequire >= 0:
            inARequire = True
            requireLine = lineNumber
            numRequiresChanged += 1

        indexOfEnd = builder.find(');')
        if (inARequire and indexOfEnd >= 0):
            numLeadingSpaces = len(builder) - 2
            allLines[requireLine] = (
                (' ' * numLeadingSpaces) +
                'if (' + ifStatement[:-1] + ') { /* FOR COVERAGE TESTING */ }\n'
            )
            allLines[requireLine + 1] = (
                (' ' * numLeadingSpaces) +
                'Require.that(' + allLines[requireLine + 1].lstrip()
            )
            inARequire = False
            inMessage = False
            ifStatement = ''
            requireLine = -1

        builder += '\n'
        allLines.append(builder)
        lineNumber += 1

    with open(filepath, 'w') as output:
        output.writelines(allLines)

    return numRequiresChanged


def main():
    files = []
    start_dir = os.getcwd()
    pattern   = "*.sol"

    dir_path = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

    for dir,_,_ in os.walk(dir_path+"/contracts"):
        files.extend(glob.glob(os.path.join(dir,pattern)))

    numHidden = 0
    for file in files:
        numHidden += hideAsserts(dir_path, file)
    print str(numHidden) + " asserts hidden."

    numRequires = 0
    for file in files:
        numRequires += fixRequires(dir_path, file)
    print str(numRequires) + " require()s fixed."

    sys.exit(0)


if __name__ == "__main__":
    main()

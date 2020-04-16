#!/bin/bash
#
# Check for identical licenses at the top of code files.

read -d '' LICENSE_RE << EOF
\\\\s*Copyright 2020 dYdX Trading Inc\\\\.

\\\\s*Licensed under the Apache License, Version 2\\\\.0 \\\\(the "License"\\\\);
\\\\s*you may not use this file except in compliance with the License\\\\.
\\\\s*You may obtain a copy of the License at

\\\\s*http://www\\\\.apache\\\\.org/licenses/LICENSE-2\\\\.0

\\\\s*Unless required by applicable law or agreed to in writing, software
\\\\s*distributed under the License is distributed on an "AS IS" BASIS,
\\\\s*WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied\\\\.
\\\\s*See the License for the specific language governing permissions and
\\\\s*limitations under the License\\\\.
EOF

# Print the names of files which do not match the pattern.
find . -not -path './node_modules/*' -not -path './dist/*' -not -path './coverage/*' \
  -type f \( -iname '*.sol' -o -iname '*.ts' -o -iname '*.js' -o -iname '*.py' \) |
  xargs pcregrep -LM "$LICENSE_RE"
if [ $? -eq 0 ]; then
  echo -e '\nFound code files (listed above) missing dYdX license statement.\n'
  exit 1
fi

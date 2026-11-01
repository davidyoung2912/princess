// Compares the `Api` interface (src/api/types.ts) with the API tables in docs/backend-data-model.md section 6: `npm run api:check`.
// Every method of the interface must be named in a table row, so the REST surface leaves nothing out (the OpenAPI side is checked by the SwaggerCoverageTests in server/).
// Methods that are in the tables but not in the interface are listed for information (new server-only routes such as `auth.login`).
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const cfgPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.app.json')
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, root)
const program = ts.createProgram(cfg.fileNames, cfg.options)
const checker = program.getTypeChecker()

const typesFile = program.getSourceFiles().find((f) => f.fileName.endsWith('/src/api/types.ts'))
const decl = typesFile.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === 'Api')
if (!decl) throw new Error('interface Api not found in src/api/types.ts')

/** "group.method" for every function in the interface, however deeply the groups nest. */
const interfaceMethods = new Set()
function walk(type, prefix, depth) {
  for (const prop of checker.getPropertiesOfType(type)) {
    const t = checker.getTypeOfSymbolAtLocation(prop, decl)
    if (t.getCallSignatures().length > 0) interfaceMethods.add(prefix + prop.name)
    else if (depth < 3 && t.getProperties().length > 0) walk(t, `${prefix}${prop.name}.`, depth + 1)
  }
}
walk(checker.getTypeAtLocation(decl), '', 0)

/** Methods named in the first column of the section 6 tables: `a.b/c/d`, `a.b` / `c`, `a.b(x)`. */
const doc = readFileSync(`${root}/docs/backend-data-model.md`, 'utf8')
const section = doc.slice(doc.indexOf('\n## 6. API surface'), doc.indexOf('\n## 7.'))
const documented = new Set()
for (const line of section.split('\n')) {
  if (!line.startsWith('|')) continue
  const cell = line.split('|')[1] ?? ''
  let prefix = ''
  for (const [, token] of cell.matchAll(/`([^`]+)`/g)) {
    const bare = token.replace(/\(.*\)$/, '')
    let names = bare
    if (bare.includes('.')) {
      const cut = bare.lastIndexOf('.')
      prefix = bare.slice(0, cut + 1)
      names = bare.slice(cut + 1)
    }
    for (const n of names.split('/')) if (/^[A-Za-z]+$/.test(n)) documented.add(prefix + n)
  }
}

const missing = [...interfaceMethods].filter((m) => !documented.has(m)).sort()
const extra = [...documented].filter((m) => !interfaceMethods.has(m)).sort()
console.log(`${interfaceMethods.size} methods in the Api interface, ${documented.size} named in the tables`)
if (extra.length > 0) console.log(`in the tables only (new routes, or renamed): ${extra.join(', ')}`)
if (missing.length > 0) {
  console.error(`not in any table row (${missing.length}):\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
console.log('every method of the Api interface has a row in section 6')

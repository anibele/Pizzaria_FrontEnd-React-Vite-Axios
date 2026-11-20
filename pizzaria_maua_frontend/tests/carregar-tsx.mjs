// Node nativo + TypeScript ja instalado: testes sem novo framework/DOM simulado.
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
registerHooks({
    resolve(specifier, context, next) {
        if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
            for (const extension of ['.ts', '.tsx']) {
                const url = new URL(specifier + extension, context.parentURL);
                if (existsSync(url)) return { url: url.href, shortCircuit: true };
            }
        }
        return next(specifier, context);
    },
    load(url, context, next) {
        if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true };
        if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
            source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: {
                jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023
            }}).outputText };
        return next(url, context);
    }
});

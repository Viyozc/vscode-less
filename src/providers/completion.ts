'use strict';

import {
	CompletionList,
	CompletionItemKind
} from 'vscode-languageserver';

import { ISymbols, IMixin } from '../types/symbols';
import { ISettings } from '../types/settings';

import { getCurrentDocumentImports, getDocumentPath } from '../utils/document';
import { getLimitedString } from '../utils/string';

/**
 * Return Mixin as string.
 *
 * @param {IMixin} symbol
 * @param {string} fsPath
 * @returns {string}
 */
function makeMixinDocumentation(symbol: IMixin, fsPath: string): string {
	const args = symbol.parameters.map((item) => `${item.name}: ${item.value}`).join(', ');

	return `${symbol.name}(${args}) {\u2026}`;
}

/**
 * Do Completion :)
 *
 * @export
 * @param {string} currentPath
 * @param {string} currentWord
 * @param {ISymbols[]} symbolsList
 * @param {ISettings} settings
 * @returns {CompletionList}
 */
export function doCompletion(currentPath: string, currentWord: string, symbolsList: ISymbols[], settings: ISettings): CompletionList {
	const completions = CompletionList.create([], false);
	const documentImports = getCurrentDocumentImports(symbolsList, currentPath);

	// is .@{NAME}-test { ... }
	const isInterpolationVariable = currentWord.endsWith('@{');

	if (settings.suggestVariables && (currentWord === '@' || isInterpolationVariable)) {
		symbolsList.forEach((symbols) => {
			const fsPath = getDocumentPath(currentPath, symbols.document);

			symbols.variables.forEach((variable) => {
				// Drop Variable if its value is RuleSet in interpolation
				// .test-@{|cursor}
				if (isInterpolationVariable && variable.value && variable.value.indexOf('{') !== -1) {
					return;
				}

				// Add 'implicitly' prefix for Path if the file imported implicitly
				let detailPath = fsPath;
				if (symbols.document !== currentPath && documentImports.indexOf(symbols.document) === -1) {
					detailPath = `(implicitly) ${detailPath}`;
				}

				// Add 'argument from MIXIN_NAME' suffix if Variable from Mixin
				let detailText = detailPath;
				if (variable.mixin) {
					detailText = `argument from ${variable.mixin}, ${detailText}`;
				}

				completions.items.push({
					// If variable interpolation, then remove the @ character from label
					label: isInterpolationVariable ? variable.name.slice(-1) : variable.name,
					kind: CompletionItemKind.Variable,
					detail: detailText,
					documentation: getLimitedString(variable.value)
				});
			});
		});
	} else if (settings.suggestMixins && (currentWord === '.' || currentPath === '#')) {
		symbolsList.forEach((symbols) => {
			const fsPath = getDocumentPath(currentPath, symbols.document);

			symbols.mixins.forEach((mixin) => {
				// Drop Mixin if his parents are calculated dynamically
				if (/[&@{}]/.test(mixin.parent)) {
					return;
				}

				// Make full name
				let fullName = mixin.name;
				if (mixin.parent) {
					fullName = mixin.parent + ' ' + fullName;
				}

				// Add 'implicitly' prefix for Path if the file imported implicitly
				let detailPath = fsPath;
				if (symbols.document !== currentPath && documentImports.indexOf(symbols.document) === -1) {
					detailPath = `(implicitly) ${detailPath}`;
				}

				completions.items.push({
					label: fullName,
					kind: CompletionItemKind.Function,
					detail: detailPath,
					documentation: makeMixinDocumentation(mixin, currentPath),
					insertText: fullName + '({{_}});'
				});
			});
		});
	}

	return completions;
}

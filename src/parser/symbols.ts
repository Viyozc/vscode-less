'use strict';

import { INode, NodeType } from '../types/nodes';
import { IVariable, IMixin, ISymbols } from '../types/symbols';

import { makeVariable, makeSetVariable } from './variable';
import { makeMixin } from './mixin';

/**
 * Get filepath of import.
 *
 * @param {INode} node
 * @returns {string}
 */
function getImportFilepath(node: INode): string {
	let filepath = node.getText().replace(/@import\s.*["'](.*)["']/, '$1');

	if (/css$/.test(filepath)) {
		return null;
	}
	if (!/less$/.test(filepath)) {
		filepath += '.less';
	}

	return filepath;
}

/**
 * Get Node by offset position.
 *
 * @param {INode} parsedDocument
 * @param {number} posOffset
 * @returns {INode}
 */
export function getNodeAtOffset(parsedDocument: INode, posOffset: number): INode {
	let candidate: INode = null;

	parsedDocument.accept((node) => {
		if (node.offset === -1 && node.length === -1) {
			return true;
		} else if (node.offset <= posOffset && node.end >= posOffset) {
			if (!candidate) {
				candidate = node;
			} else if (node.length <= candidate.length) {
				candidate = node;
			}
			return true;
		}
		return false;
	});

	return candidate;
}

/**
 * Get all suggestions in file.
 *
 * @export
 * @param {INode} parsedDocument
 * @returns {IOccurrence}
 */
export function findSymbols(parsedDocument: INode): ISymbols {
	let variables: IVariable[] = [];
	let mixins: IMixin[] = [];
	let imports: string[] = [];

	parsedDocument.accept((node: INode) => {
		if (node.type === NodeType.Import) {
			const filepath = getImportFilepath(node);
			if (filepath) {
				imports.push(filepath);
			}
		} else if (node.type === NodeType.VariableDeclaration && node.getParent().type === NodeType.Stylesheet) {
			if (node.getValue()) {
				variables.push(makeVariable(node));
			}
		} else if (node.type === NodeType.MixinDeclaration) {
			mixins.push(makeMixin(node));
		}

		return true;
	});

	return {
		variables,
		mixins,
		imports
	};
}

/**
 * Get Symbols by offset position.
 *
 * @export
 * @param {INode} parsedDocument
 * @param {number} posOffset
 * @returns {IOccurrence}
 */
export function findSymbolsAtOffset(parsedDocument: INode, offset: number): ISymbols {
	let variables: IVariable[] = [];
	let mixins: IMixin[] = [];
	let imports: string[] = [];

	let node = getNodeAtOffset(parsedDocument, offset);
	if (!node) {
		return {
			variables,
			mixins,
			imports
		};
	}

	node = node.getParent();
	while (true) {
		if (!node || node.type === NodeType.Stylesheet) {
			break;
		} else if (node.type === NodeType.MixinDeclaration) {
			const mixin = makeMixin(node);

			mixins.push(mixin);
			variables.push(
				...mixin.parameters,
				...makeSetVariable(node)
			);
		} else if (node.type === NodeType.Ruleset) {
			variables.push(...makeSetVariable(node));
		}

		node = node.getParent();
	}

	return {
		variables,
		mixins,
		imports
	};
}
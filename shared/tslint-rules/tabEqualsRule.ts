import {IRuleMetadata, RuleFailure} from 'tslint/lib/language/rule/rule';
import {RuleWalker} from 'tslint/lib/language/walker';
import {AbstractRule} from 'tslint/lib/rules';
import * as ts from 'tslint/node_modules/typescript';


export class Rule extends AbstractRule {
	public static metadata: IRuleMetadata	= {
		ruleName: 'tab-equals',
		description:
			'Requires = in variable assignment to be preceded by tab(s)' +
			'and followed by either a newline or exactly one space.'
		,
		descriptionDetails: 'For alignment.',
		optionsDescription: 'Not configurable.',
		options: null,
		optionExamples: ['true'],
		type: 'style',
		typescriptOnly: false
	};

	public static FAILURE_STRING: string	=
		'assignment operator must be preceded by tab(s) and followed by newline or space'
	;

	public static isCompliant (node: ts.PropertyDeclaration|ts.VariableStatement) : boolean {
		const equalsSplit	= node.getText().replace(/=>/g, '').split('=');

		if (equalsSplit.length < 2) {
			return true;
		}

		const equalsPrefix	= (equalsSplit[0].match(/\s+$/) || [''])[0];
		const equalsSuffix	= (equalsSplit[1].match(/^\s+/) || [''])[0];

		return (
			(equalsPrefix.match(/\t/) && !equalsPrefix.match(/ /)) &&
			(
				(equalsSuffix[0] === '\n' && !equalsSuffix.match(/ /)) || 
				(equalsSuffix[0] === ' ' && equalsSuffix.length === 1)
			)
		);
	}

	public apply (sourceFile: ts.SourceFile, languageService: ts.LanguageService) : RuleFailure[] {
		return this.applyWithWalker(
			new TabEqualsWalker(sourceFile, this.getOptions())
		);
	}
}

class TabEqualsWalker extends RuleWalker {
	public visitPropertyDeclaration (node: ts.PropertyDeclaration) : void {
		try {
			if (Rule.isCompliant(node)) {
				return;
			}

			this.addFailure(
				this.createFailure(
					node.getStart(),
					node.getWidth(),
					Rule.FAILURE_STRING
				)
			);
		}
		finally {
			super.visitPropertyDeclaration(node);
		}
	}

	public visitVariableStatement (node: ts.VariableStatement) : void {
		try {
			if (Rule.isCompliant(node)) {
				return;
			}

			this.addFailure(
				this.createFailure(
					node.getStart(),
					node.getWidth(),
					Rule.FAILURE_STRING
				)
			);
		}
		finally {
			super.visitVariableStatement(node);
		}
	}
}

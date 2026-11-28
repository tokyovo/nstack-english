// Finds interface text written straight into JSX instead of coming from the
// messages file through t(). Used by ui-strings.test.ts; not part of the app.
import ts from 'typescript';

export type UiStringFinding = { file: string; line: number; text: string };

/** Props whose value a user sees or hears. */
const TEXT_PROPS = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'placeholder',
  'title',
  'alt',
  'aria-label',
  'label',
]);

const LETTER = /\p{L}/u;

/** Keys of a screen's `options` object that show up as a header or tab title. */
const OPTION_TEXT_KEYS = new Set(['title', 'headerTitle']);

/** Shown in place of each `${...}` substitution; contains no letter, so `${n}` alone is allowed. */
const SUBSTITUTION = '${…}';

type Literal = { text: string; node: ts.Node };

/**
 * Literal text an expression can evaluate to directly: `"a"`, `` `a ${n}` ``, `c ? "a" : "b"`,
 * `c && "a"`, `"a" + name`.
 */
function literalsIn(expression: ts.Expression): Literal[] {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return [{ text: expression.text, node: expression }];
  }
  if (ts.isTemplateExpression(expression)) {
    const text = expression.head.text + expression.templateSpans.map((span) => SUBSTITUTION + span.literal.text).join('');
    return [{ text, node: expression }];
  }
  if (ts.isParenthesizedExpression(expression)) return literalsIn(expression.expression);
  if (ts.isConditionalExpression(expression)) {
    return [...literalsIn(expression.whenTrue), ...literalsIn(expression.whenFalse)];
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return literalsIn(expression.right);
    if (
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken ||
      operator === ts.SyntaxKind.PlusToken
    ) {
      return [...literalsIn(expression.left), ...literalsIn(expression.right)];
    }
  }
  return [];
}

/** Values of `title` and `headerTitle` in `options={{ ... }}`. */
function optionTextValues(expression: ts.Expression | undefined): ts.Expression[] {
  if (!expression || !ts.isObjectLiteralExpression(expression)) return [];
  return expression.properties.flatMap((property) =>
    ts.isPropertyAssignment(property) && OPTION_TEXT_KEYS.has(property.name.getText()) ? [property.initializer] : []
  );
}

export function findUiStringLiterals(source: string, file: string): UiStringFinding[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: UiStringFinding[] = [];

  function report(rawText: string, position: number) {
    const text = rawText.replace(/\s+/g, ' ').trim();
    if (!LETTER.test(text)) return;
    const line = sourceFile.getLineAndCharacterOfPosition(position).line + 1;
    findings.push({ file, line, text });
  }

  function reportLiterals(expression: ts.Expression | undefined) {
    if (!expression) return;
    for (const literal of literalsIn(expression)) report(literal.text, literal.node.getStart());
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      report(node.text, node.pos + node.text.search(/\S|$/));
    } else if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      reportLiterals(node.expression);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const prop = node.name.getText(sourceFile);
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined;
      if (TEXT_PROPS.has(prop)) {
        if (ts.isStringLiteral(node.initializer)) report(node.initializer.text, node.initializer.getStart());
        else reportLiterals(value);
      } else if (prop === 'options') {
        optionTextValues(value).forEach(reportLiterals);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

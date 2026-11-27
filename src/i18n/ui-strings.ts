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

function isStringLiteral(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/** String literals an expression can evaluate to directly: `"a"`, `c ? "a" : "b"`, `c && "a"`. */
function literalsIn(expression: ts.Expression): (ts.StringLiteral | ts.NoSubstitutionTemplateLiteral)[] {
  if (isStringLiteral(expression)) return [expression];
  if (ts.isParenthesizedExpression(expression)) return literalsIn(expression.expression);
  if (ts.isConditionalExpression(expression)) {
    return [...literalsIn(expression.whenTrue), ...literalsIn(expression.whenFalse)];
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return literalsIn(expression.right);
    if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken) {
      return [...literalsIn(expression.left), ...literalsIn(expression.right)];
    }
  }
  return [];
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
    for (const literal of literalsIn(expression)) report(literal.text, literal.getStart());
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      report(node.text, node.pos + node.text.search(/\S|$/));
    } else if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      reportLiterals(node.expression);
    } else if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.getText(sourceFile)) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) report(node.initializer.text, node.initializer.getStart());
      else if (ts.isJsxExpression(node.initializer)) reportLiterals(node.initializer.expression);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

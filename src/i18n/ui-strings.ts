// Finds interface text written straight into JSX instead of coming from the
// messages file through t(). Used by ui-strings.test.ts; not part of the app.
//
// The rule is inverted on purpose: inside a JSX element every string with a
// letter is reported, wherever it sits (children, props, nested objects,
// arrays, callbacks, conditionals), unless it is the value of a prop or object
// key in NON_UI_KEYS or the message key passed to t(). An unknown prop or key
// is reported, so a new way of showing text cannot slip through unnoticed.
import ts from 'typescript';

export type UiStringFinding = { file: string; line: number; text: string };

/** Props and object keys whose values are never shown or read out to a user. */
const NON_UI_KEYS = new Set([
  // identity, keys and routes
  'key',
  'testID',
  'nativeID',
  'name',
  'href',
  'pathname',
  // accessibility semantics (not labels or hints)
  'role',
  'accessibilityRole',
  'accessibilityLanguage',
  'lang',
  'importantForAccessibility',
  // input behaviour
  'keyboardType',
  'autoComplete',
  'autoCapitalize',
  'textContentType',
  'inputMode',
  'returnKeyType',
  'enterKeyHint',
  // style, layout and component variants
  'style',
  'fontFamily',
  'type',
  'resizeMode',
  'pointerEvents',
  'animation',
  'presentation',
]);

const LETTER = /\p{L}/u;

/** Shown in place of each `${...}` substitution; contains no letter, so `${n}` alone is allowed. */
const SUBSTITUTION = '${…}';

const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.InKeyword,
]);

/** Object keys (route objects, navigator options, styles) whose values are never shown; props use NON_UI_KEYS. */
const NON_UI_OBJECT_KEYS = new Set(['pathname', 'animation', 'presentation', 'fontFamily']);

function isNonUiKey(name: ts.PropertyName | ts.JsxAttributeName, keys = NON_UI_KEYS): boolean {
  return (ts.isIdentifier(name) || ts.isStringLiteral(name)) && keys.has(name.text);
}

function isJsx(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
}

/** The key in `t("key", ...)`, or a string compared or used as an index (`x === "web"`, `o["k"]`): never rendered. */
function isNeverRendered(literal: ts.Node): boolean {
  const parent = literal.parent;
  if (ts.isCallExpression(parent)) {
    return ts.isIdentifier(parent.expression) && parent.expression.text === 't' && parent.arguments[0] === literal;
  }
  if (ts.isBinaryExpression(parent)) return COMPARISONS.has(parent.operatorToken.kind);
  return ts.isElementAccessExpression(parent) && parent.argumentExpression === literal;
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

  function reportLiteral(node: ts.Node): boolean {
    if (ts.isJsxText(node)) {
      report(node.text, node.pos + node.text.search(/\S|$/));
      return true;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isNeverRendered(node)) report(node.text, node.getStart());
      return true;
    }
    if (ts.isTemplateExpression(node)) {
      report(node.head.text + node.templateSpans.map((span) => SUBSTITUTION + span.literal.text).join(''), node.getStart());
    }
    return false;
  }

  function visit(node: ts.Node, inJsx: boolean) {
    if (ts.isTypeNode(node)) return;
    if (ts.isJsxAttribute(node) && isNonUiKey(node.name)) return;
    if (ts.isPropertyAssignment(node)) {
      if (!isNonUiKey(node.name, NON_UI_OBJECT_KEYS)) visit(node.initializer, inJsx);
      return;
    }
    if (inJsx && reportLiteral(node)) return;
    const childInJsx = inJsx || isJsx(node);
    // A template's static parts were reported whole; only its substitutions are visited.
    if (ts.isTemplateExpression(node)) {
      node.templateSpans.forEach((span) => visit(span.expression, childInJsx));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, childInJsx));
  }

  visit(sourceFile, false);
  return findings;
}

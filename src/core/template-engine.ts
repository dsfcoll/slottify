import { TemplateParser } from './template-parser.ts';
import type {
  ExpressionNode,
  ASTNode,
  FilterNode,
} from './types/ast-types.ts';

type FilterFunction = (value: unknown, ...args: unknown[]) => unknown;

type TemplateContext = Record<string, unknown>;

class TemplateEngine {
  private filters: Record<string, FilterFunction> = {
    lower: (value: unknown): string => String(value).toLowerCase(),
    upper: (value: unknown): string => String(value).toUpperCase(),
    capitalize: (value: unknown) => {
      const r = String(value);
      return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
    },
    includes: (value: unknown, search: unknown): boolean => String(value).includes(String(search)),
  };

  private astCache = new Map();

  compile(template: string): ASTNode[] {
    if (this.astCache.has(template)) {
      const ast = this.astCache.get(template);
      return ast;
    }
    const parser = new TemplateParser(template);
    const ast = parser.parse();
    this.astCache.set(template, ast);
    return ast;
  }

  evaluate(ast: ASTNode[], context: TemplateContext = {}): string {
    return ast.map((node) => this.evaluateNode(node, context)).join('');
  }

  private evaluateNode(node: ASTNode, context: TemplateContext): string {
    switch (node.type) {
      case 'TEXT':
        return node.value;

      case 'TEMPLATE':
        return String(this.evaluateExpression(node.expression, context));

      default:
        return '';
    }
  }

  private evaluateExpression(expr: ExpressionNode, context: TemplateContext): any {
    switch (expr.type) {
      case 'VARIABLE':
        return context[expr.name] || '';

      case 'STRING':
        return expr.value;

      case 'PIPE': {
        const value = this.evaluateExpression(expr.left, context);
        return this.applyFilter(expr.filter, value, context);
      }
      case 'TERNARY': {
        const condition = this.evaluateExpression(expr.condition, context);
        return condition
          ? this.evaluateExpression(expr.trueExpr, context)
          : this.evaluateExpression(expr.falseExpr, context);
      }
      case 'OR': {
        const left = this.evaluateExpression(expr.left, context);
        return left || this.evaluateExpression(expr.right, context);
      }

      default:
        return '';
    }
  }

  private applyFilter(filter: FilterNode, value: any, context: TemplateContext): any {
    const filterFn = this.filters[filter.name];
    if (!filterFn) {
      throw new Error(`Unknown filter: ${filter.name}`);
    }

    const args = filter.args.map((arg) => this.evaluateExpression(arg, context));
    return filterFn(value, ...args);
  }

  render(template: string, context: TemplateContext = {}): string {
    const ast = this.compile(template);
    return this.evaluate(ast, context);
  }

  // Method to add custom filters
  addFilter(name: string, fn: FilterFunction): void {
    this.filters[name] = fn;
  }

  // Method to get available filters
  getFilters(): string[] {
    return Object.keys(this.filters);
  }
}

export { TemplateEngine };

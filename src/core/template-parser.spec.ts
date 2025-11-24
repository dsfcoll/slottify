import { describe, it, expect } from 'vitest';
import { TemplateParser } from './';
import { TemplateNode, TernaryNode } from './types/ast-types.ts';

describe('TemplateParser', () => {
  describe('Tokenization', () => {
    it('should tokenize plain text', () => {
      const parser = new TemplateParser('Hello World');
      const ast = parser.parse();

      expect(ast).toHaveLength(1);
      expect(ast[0]).toEqual({
        type: 'TEXT',
        value: 'Hello World',
      });
    });

    it('should tokenize template with variable', () => {
      const parser = new TemplateParser('Hello {{ name }}!');
      const ast = parser.parse();

      expect(ast).toHaveLength(3);
      expect(ast[0]).toEqual({ type: 'TEXT', value: 'Hello ' });
      expect(ast[1]).toEqual({
        type: 'TEMPLATE',
        expression: { type: 'VARIABLE', name: 'name' },
      });
      expect(ast[2]).toEqual({ type: 'TEXT', value: '!' });
    });

    it('should handle whitespace in templates', () => {
      const parser = new TemplateParser('{{  name  }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: { type: 'VARIABLE', name: 'name' },
      }]);
    });

    it('should tokenize string literals', () => {
      const parser = new TemplateParser('{{ \'hello\' }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: { type: 'STRING', value: 'hello' },
      }]);
    });

    it('should handle escaped quotes in strings', () => {
      const parser = new TemplateParser(`{{ 'it\\'s working' }}`);
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: { type: 'STRING', value: 'it\'s working' },
      }]);
    });
  });

  describe('Filter Parsing', () => {
    it('should parse single filter', () => {
      const parser = new TemplateParser('{{ name | lower }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: {
          type: 'PIPE',
          left: { type: 'VARIABLE', name: 'name' },
          filter: { type: 'FILTER', name: 'lower', args: [] },
        },
      }]);
    });

    it('should parse chained filters', () => {
      const parser = new TemplateParser('{{ name | lower | upper }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: {
          type: 'PIPE',
          left: {
            type: 'PIPE',
            left: { type: 'VARIABLE', name: 'name' },
            filter: { type: 'FILTER', name: 'lower', args: [] },
          },
          filter: { type: 'FILTER', name: 'upper', args: [] },
        },
      }]);
    });

    it('should parse filter with arguments', () => {
      const parser = new TemplateParser('{{ name | includes \'peter\' }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: {
          type: 'PIPE',
          left: { type: 'VARIABLE', name: 'name' },
          filter: {
            type: 'FILTER',
            name: 'includes',
            args: [{ type: 'STRING', value: 'peter' }],
          },
        },
      }]);
    });
  });

  describe('Ternary Expressions', () => {
    it('should parse simple ternary', () => {
      const parser = new TemplateParser('{{ condition ? \'yes\' : \'no\' }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: {
          type: 'TERNARY',
          condition: { type: 'VARIABLE', name: 'condition' },
          trueExpr: { type: 'STRING', value: 'yes' },
          falseExpr: { type: 'STRING', value: 'no' },
        },
      }]);
    });

    it('should parse complex ternary with filters', () => {
      const parser = new TemplateParser('{{ name | lower | includes \'peter\' ? \'no peter!\' : name }}');
      const ast = parser.parse();

      const expression = ast[0] as TemplateNode<TernaryNode>;
      expect(expression.expression.type).toBe('TERNARY');
      expect(expression.expression.condition.type).toBe('PIPE');
      expect(expression.expression.trueExpr).toEqual({ type: 'STRING', value: 'no peter!' });
      expect(expression.expression.falseExpr).toEqual({ type: 'VARIABLE', name: 'name' });
    });
  });

  describe('Or Expressions', () => {
    it('should parse simple or fallback', () => {
      const parser = new TemplateParser('{{ category_meta_title or category }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: {
          type: 'OR',
          left: { type: 'VARIABLE', name: 'category_meta_title' },
          right: { type: 'VARIABLE', name: 'category' },
        },
      }]);
    });

    it('should parse or with string fallback', () => {
      const parser = new TemplateParser('{{ name or \'default\' }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: {
          type: 'OR',
          left: { type: 'VARIABLE', name: 'name' },
          right: { type: 'STRING', value: 'default' },
        },
      }]);
    });

    it('should parse chained or expressions', () => {
      const parser = new TemplateParser('{{ a or b or c }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: {
          type: 'OR',
          left: {
            type: 'OR',
            left: { type: 'VARIABLE', name: 'a' },
            right: { type: 'VARIABLE', name: 'b' },
          },
          right: { type: 'VARIABLE', name: 'c' },
        },
      }]);
    });

    it('should parse or with filters', () => {
      const parser = new TemplateParser('{{ name | lower or \'default\' }}');
      const ast = parser.parse();

      expect(ast).toStrictEqual([{
        type: 'TEMPLATE',
        expression: {
          type: 'OR',
          left: {
            type: 'PIPE',
            left: { type: 'VARIABLE', name: 'name' },
            filter: { type: 'FILTER', name: 'lower', args: [] },
          },
          right: { type: 'STRING', value: 'default' },
        },
      }]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unclosed template', () => {
      expect(() => {
        new TemplateParser('{{ name').parse();
      }).toThrow('Expected CLOSE_TEMPLATE');
    });

    it('should throw error for unexpected token', () => {
      expect(() => {
        new TemplateParser('{{ 123 }}').parse();
      }).toThrow('Unexpected token');
    });

    it('should throw error for malformed ternary', () => {
      expect(() => {
        new TemplateParser('{{ condition ? \'yes\' }}').parse();
      }).toThrow('Expected COLON');
    });
  });
});

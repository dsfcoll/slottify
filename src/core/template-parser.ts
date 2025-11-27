import type {
  ExpressionNode,
  ASTNode,
  FilterNode,
  TemplateNode,
} from './types/ast-types.ts';
import type { Token, TokenType } from './types/token-types.ts';

class TemplateParser {
  private input: string;
  private tokens: Token[];
  private current: number = 0;

  constructor(input: string) {
    this.input = input;
    this.tokens = this.tokenize();
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  private tokenize(): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    let insideTemplate = false;

    while (i < this.input.length) {
      if (this.input.slice(i, i + 2) === '{{') {
        tokens.push({ type: 'OPEN_TEMPLATE', value: '{{' });
        insideTemplate = true;
        i += 2;
        continue;
      }

      if (this.input.slice(i, i + 2) === '}}') {
        tokens.push({ type: 'CLOSE_TEMPLATE', value: '}}' });
        insideTemplate = false;
        i += 2;
        continue;
      }

      // If we're inside a template, parse template tokens
      if (insideTemplate) {
        // Skip whitespace inside templates
        if (/\s/.test(this.input[i])) {
          i++;
          continue;
        }

        // Pipe operator
        if (this.input[i] === '|') {
          tokens.push({ type: 'PIPE', value: '|' });
          i++;
          continue;
        }

        // Ternary operators
        if (this.input[i] === '?') {
          tokens.push({ type: 'QUESTION', value: '?' });
          i++;
          continue;
        }

        if (this.input[i] === ':') {
          tokens.push({ type: 'COLON', value: ':' });
          i++;
          continue;
        }

        // String literals
        if (this.input[i] === '\'' || this.input[i] === '"') {
          const quote = this.input[i];
          let str = '';
          i++; // Skip opening quote

          while (i < this.input.length && this.input[i] !== quote) {
            if (this.input[i] === '\\') {
              i++; // Skip escape char
              if (i < this.input.length) {
                str += this.input[i];
              }
            } else {
              str += this.input[i];
            }
            i++;
          }

          if (i < this.input.length) i++; // Skip closing quote
          tokens.push({ type: 'STRING', value: str });
          continue;
        }

        // Identifiers and keywords inside templates
        if (/[a-zA-Z_]/.test(this.input[i])) {
          let identifier = '';
          while (i < this.input.length && /\w/.test(this.input[i])) {
            identifier += this.input[i];
            i++;
          }
          // Check if it's the 'or' keyword
          if (identifier === 'or') {
            tokens.push({ type: 'OR', value: identifier });
          } else {
            tokens.push({ type: 'IDENTIFIER', value: identifier });
          }
          continue;
        }

        // Unknown character inside template
        i++;
      } else {
        // Outside templates - collect text until we hit a template start
        let text = '';
        while (i < this.input.length && this.input.substr(i, 2) !== '{{') {
          text += this.input[i];
          i++;
        }

        if (text) {
          tokens.push({ type: 'TEXT', value: text });
        }
      }
    }

    return tokens;
  }

  private peek(): Token | null {
    return this.current < this.tokens.length ? this.tokens[this.current] : null;
  }

  private advance(): Token {
    if (this.current < this.tokens.length) {
      this.current++;
    }
    return this.tokens[this.current - 1];
  }

  private match(type: TokenType): Token | null {
    if (this.peek()?.type === type) {
      return this.advance();
    }
    return null;
  }

  private expect(type: TokenType): Token {
    const token = this.match(type);
    if (!token) {
      throw new Error(`Expected ${type} but got ${this.peek()?.type || 'EOF'}`);
    }
    return token;
  }

  parse(): ASTNode[] {
    const nodes: ASTNode[] = [];

    while (this.current < this.tokens.length) {
      const node = this.parseNode();
      if (node) nodes.push(node);
    }

    return nodes;
  }

  private parseNode(): ASTNode | null {
    const token = this.peek();

    if (!token) return null;

    if (token.type === 'TEXT') {
      return {
        type: 'TEXT',
        value: this.advance().value,
      };
    }

    if (token.type === 'OPEN_TEMPLATE') {
      return this.parseTemplate();
    }

    this.advance(); // Skip unknown tokens
    return null;
  }

  private parseTemplate(): TemplateNode {
    this.expect('OPEN_TEMPLATE');
    const expression = this.parseExpression();
    this.expect('CLOSE_TEMPLATE');

    return {
      type: 'TEMPLATE',
      expression,
    };
  }

  private parseExpression(): ExpressionNode {
    return this.parseTernary();
  }

  private parseTernary(): ExpressionNode {
    const left = this.parseOr();

    if (this.match('QUESTION')) {
      const trueExpr = this.parseExpression();
      this.expect('COLON');
      const falseExpr = this.parseExpression();

      return {
        type: 'TERNARY',
        condition: left,
        trueExpr,
        falseExpr,
      };
    }

    return left;
  }

  private parseOr(): ExpressionNode {
    let left = this.parsePipeline();

    while (this.match('OR')) {
      const right = this.parsePipeline();
      left = {
        type: 'OR',
        left,
        right,
      };
    }

    return left;
  }

  private parsePipeline(): ExpressionNode {
    let left = this.parsePrimary();

    while (this.match('PIPE')) {
      const filter = this.parseFilter();
      left = {
        type: 'PIPE',
        left,
        filter,
      };
    }

    return left;
  }

  private parseFilter(): FilterNode {
    const name = this.expect('IDENTIFIER').value;
    const args: ExpressionNode[] = [];

    // Parse filter arguments if any
    while (this.peek()
      && this.peek()!.type !== 'PIPE'
      && this.peek()!.type !== 'QUESTION'
      && this.peek()!.type !== 'COLON'
      && this.peek()!.type !== 'OR'
      && this.peek()!.type !== 'CLOSE_TEMPLATE') {
      args.push(this.parsePrimary());
    }

    return {
      type: 'FILTER',
      name,
      args,
    };
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek();

    if (token?.type === 'IDENTIFIER') {
      return {
        type: 'VARIABLE',
        name: this.advance().value,
      };
    }

    if (token?.type === 'STRING') {
      return {
        type: 'STRING',
        value: this.advance().value,
      };
    }

    throw new Error(`Unexpected token: ${token?.type || 'EOF'}`);
  }
}

export { TemplateParser };

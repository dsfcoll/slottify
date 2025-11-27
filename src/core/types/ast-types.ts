export interface TextNode {
  type: 'TEXT';
  value: string;
}

export interface VariableNode {
  type: 'VARIABLE';
  name: string;
}

export interface StringNode {
  type: 'STRING';
  value: string;
}

export interface FilterNode {
  type: 'FILTER';
  name: string;
  args: ExpressionNode[];
}

export interface PipeNode {
  type: 'PIPE';
  left: ExpressionNode;
  filter: FilterNode;
}

export interface TernaryNode {
  type: 'TERNARY';
  condition: ExpressionNode;
  trueExpr: ExpressionNode;
  falseExpr: ExpressionNode;
}

export interface OrNode {
  type: 'OR';
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface TemplateNode<T = ExpressionNode> {
  type: 'TEMPLATE';
  expression: ExpressionNode<T>;
}

export type ExpressionNode<T = VariableNode | StringNode | PipeNode | TernaryNode | OrNode> = T;
export type ASTNode<T = ExpressionNode> = TextNode | TemplateNode<T>;

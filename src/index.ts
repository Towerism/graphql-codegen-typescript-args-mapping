import { oldVisit, PluginFunction } from "@graphql-codegen/plugin-helpers";
import { transformSchemaAST } from "@graphql-codegen/schema-ast";
import { TsVisitor } from "@graphql-codegen/typescript";
import {
  FieldDefinitionNode,
  InterfaceTypeExtensionNode,
  ObjectTypeDefinitionNode,
} from "graphql";
import { Config } from "./config";

type Node = InterfaceTypeExtensionNode | ObjectTypeDefinitionNode;
type BuildArgumentsBlockFunction = (node: Node) => string;

interface FieldNode extends FieldDefinitionNode {
  convertedName: string;
}

type FieldNameMap = { [name: string]: FieldNode };

interface NodeForArgsMapping {
  nameToFieldsMap: FieldNameMap;
  originalNode: Node;
}

export const plugin: PluginFunction<Config> = (schema, _documents, config) => {
  const { schema: _schema, ast } = transformSchemaAST(schema, config);

  const BaseTypesVisitor = Object.getPrototypeOf(TsVisitor.prototype);

  const _buildArgumentsBlock: BuildArgumentsBlockFunction =
    BaseTypesVisitor.buildArgumentsBlock;

  const nodes: Array<NodeForArgsMapping> = [];
  const buildArgumentsBlock: BuildArgumentsBlockFunction = function (node) {
    const nameToFieldsMap = node.fields
      .filter((field) => field.arguments && field.arguments.length > 0)
      .map((field) => ({
        ...field,
        convertedName: this.convertName(field, {
          useTypesPrefix: false,
          transformUnderscore: true,
        }),
      }))
      .reduce((acc: FieldNameMap, curr) => {
        const name = curr.name.value;
        acc[name] = curr;
        return acc;
      }, {});

    const onlyTypeNames = config.mapArgsOnlyForTypeNames || [];
    if (onlyTypeNames.includes(node.name.value) || !onlyTypeNames.length) {
      nodes.push({ originalNode: node, nameToFieldsMap });
    }

    return _buildArgumentsBlock.apply(this, [node]);
  };

  BaseTypesVisitor.buildArgumentsBlock = buildArgumentsBlock;

  const visitor = new TsVisitor(_schema, config);

  oldVisit(ast, { leave: visitor });

  return nodes
    .map(({ originalNode, nameToFieldsMap }) => {
      const nodeName = originalNode.name.value;
      return [
        `export type ${nodeName}Args = {`,
        ...originalNode.fields.map((field) => {
          const hasArgs = !!field.arguments.length;
          const mappedField = nameToFieldsMap[field.name.value];
          const mappedType = hasArgs
            ? `${nodeName}${mappedField.convertedName}Args`
            : "{}";
          return `  ${field.name.value}: ${mappedType};`;
        }),
        "};",
      ].join("\n");
    })
    .join("\n\n");
};

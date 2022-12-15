import {TypeScriptPluginConfig} from "@graphql-codegen/typescript";

export interface Config extends TypeScriptPluginConfig {
  mapArgsOnlyForTypeNames?: string[]
}

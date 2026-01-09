#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use crate::proxy::config::ModelMappingTarget;
    use crate::proxy::common::model_mapping::resolve_model_chain;

    #[test]
    fn test_single_mapping() {
        let mut mapping = HashMap::new();
        mapping.insert(
            "gpt-4".to_string(),
            ModelMappingTarget::Single("gemini-pro".to_string())
        );

        let chain = resolve_model_chain("gpt-4", &mapping);
        assert_eq!(chain, vec!["gemini-pro"]);
    }

    #[test]
    fn test_chain_mapping() {
        let mut mapping = HashMap::new();
        mapping.insert(
            "gpt-4".to_string(),
            ModelMappingTarget::Chain(vec!["gemini-pro".to_string(), "gemini-flash".to_string()])
        );

        let chain = resolve_model_chain("gpt-4", &mapping);
        assert_eq!(chain, vec!["gemini-pro", "gemini-flash"]);
    }

    #[test]
    fn test_wildcard_chain_mapping() {
        let mut mapping = HashMap::new();
        mapping.insert(
            "gpt-4*".to_string(),
            ModelMappingTarget::Chain(vec!["gemini-pro".to_string(), "gemini-flash".to_string()])
        );

        let chain = resolve_model_chain("gpt-4-turbo", &mapping);
        assert_eq!(chain, vec!["gemini-pro", "gemini-flash"]);
    }

    #[test]
    fn test_default_fallback() {
        let mapping = HashMap::new();
        // Unknown model should map to default claude fallback
        let chain = resolve_model_chain("unknown-model", &mapping);
        assert_eq!(chain.len(), 1);
        // Based on implementation, default fallback is "claude-sonnet-4-5"
        assert_eq!(chain[0], "claude-sonnet-4-5");
    }

    #[test]
    fn test_chain_deserialization() {
        // Test that JSON config can be deserialized into our structure
        let json_single = r#"{"gpt-4": "gemini-pro"}"#;
        let mapping_single: HashMap<String, ModelMappingTarget> = serde_json::from_str(json_single).unwrap();

        match mapping_single.get("gpt-4").unwrap() {
            ModelMappingTarget::Single(s) => assert_eq!(s, "gemini-pro"),
            _ => panic!("Expected Single"),
        }

        let json_chain = r#"{"gpt-4": ["gemini-pro", "gemini-flash"]}"#;
        let mapping_chain: HashMap<String, ModelMappingTarget> = serde_json::from_str(json_chain).unwrap();

        match mapping_chain.get("gpt-4").unwrap() {
            ModelMappingTarget::Chain(v) => assert_eq!(v, &vec!["gemini-pro", "gemini-flash"]),
            _ => panic!("Expected Chain"),
        }
    }
}

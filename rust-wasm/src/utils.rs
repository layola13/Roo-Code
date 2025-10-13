//! Utility Functions Module
//! 
//! Common utility functions used across modules

use wasm_bindgen::prelude::*;

/// Generate a unique ID
pub fn generate_id(prefix: &str) -> String {
    let timestamp = js_sys::Date::now() as u64;
    let random = (js_sys::Math::random() * 1000000.0) as u32;
    format!("{}_{}{}", prefix, timestamp, random)
}

/// Format timestamp to ISO string
#[wasm_bindgen]
pub fn format_timestamp(timestamp: u64) -> String {
    let date = js_sys::Date::new(&JsValue::from_f64(timestamp as f64));
    date.to_iso_string().as_string().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_generate_id() {
        let id1 = generate_id("task");
        let id2 = generate_id("task");
        
        assert!(id1.starts_with("task_"));
        assert!(id2.starts_with("task_"));
        assert_ne!(id1, id2); // IDs should be unique
    }
}
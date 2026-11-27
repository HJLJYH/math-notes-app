package com.mathnotes.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AttachmentPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

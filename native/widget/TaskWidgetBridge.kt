package com.sade.calendar.widget

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import org.json.JSONArray

class TaskWidgetBridge(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "TaskWidgetBridge"
  @ReactMethod fun update(json: String, days: Int, promise: Promise) {
    try {
      require(json.length <= 256000) { "Widget snapshot too large" }
      JSONArray(json) // Validate before sharing with the receiver.
      WidgetDataRepository.save(reactApplicationContext, json, if (days == 30) 30 else 7)
      WidgetUpdater.updateAll(reactApplicationContext)
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("WIDGET_UPDATE", error) }
  }
}

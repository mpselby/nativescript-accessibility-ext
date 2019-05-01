import { View as TNSView } from 'tns-core-modules/ui/core/view';
import { GestureTypes } from 'tns-core-modules/ui/gestures/gestures';
import { notifyAccessibilityFocusState, writeTrace } from './helpers';
import { isAccessibilityServiceEnabled } from './utils';

const AccessibilityEvent = android.view.accessibility.AccessibilityEvent;
type AccessibilityEvent = android.view.accessibility.AccessibilityEvent;
const AccessibilityManager = android.view.accessibility.AccessibilityManager;
type AccessibilityManager = android.view.accessibility.AccessibilityManager;
const AccessibilityDelegateCompat = android.support.v4.view.AccessibilityDelegateCompat;
type AccessibilityDelegateCompat = android.support.v4.view.AccessibilityDelegateCompat;
const AccessibilityNodeInfoCompat = android.support.v4.view.accessibility.AccessibilityNodeInfoCompat;
type AccessibilityNodeInfoCompat = android.support.v4.view.accessibility.AccessibilityNodeInfoCompat;
const RecyclerViewAccessibilityDelegate = android.support.v7.widget.RecyclerViewAccessibilityDelegate;
type RecyclerViewAccessibilityDelegate = android.support.v7.widget.RecyclerViewAccessibilityDelegate;
const RecyclerViewAccessibilityItemDelegate = android.support.v7.widget.RecyclerViewAccessibilityDelegate.ItemDelegate;
type RecyclerViewAccessibilityItemDelegate = android.support.v7.widget.RecyclerViewAccessibilityDelegate.ItemDelegate;

const AndroidView = android.view.View;
type AndroidView = android.view.View;
const AndroidViewGroup = android.view.ViewGroup;
type AndroidViewGroup = android.view.ViewGroup;
const ViewCompat = android.support.v4.view.ViewCompat;
type ViewCompat = android.support.v4.view.ViewCompat;
const AndroidBundle = android.os.Bundle;
type AndroidBundle = android.os.Bundle;

function getAccessibilityManager(view: AndroidView): AccessibilityManager {
  return view.getContext().getSystemService(android.content.Context.ACCESSIBILITY_SERVICE);
}

let lastFocusedView: WeakRef<TNSView>;
function accessibilityEventHelper(owner: TNSView, eventType: number) {
  if (!isAccessibilityServiceEnabled()) {
    return;
  }

  if (!owner) {
    return;
  }

  switch (eventType) {
    case AccessibilityEvent.TYPE_VIEW_CLICKED: {
      /**
       * Android API >= 26 handles accessibility tap-events by converting them to TYPE_VIEW_CLICKED
       * These aren't triggered for custom tap events in NativeScript.
       */
      if (android.os.Build.VERSION.SDK_INT >= 26) {
        // Find all tap gestures and trigger them.
        for (const tapGesture of owner.getGestureObservers(GestureTypes.tap) || []) {
          tapGesture.callback({
            android: owner.android,
            eventName: 'tap',
            ios: null,
            object: owner,
            type: GestureTypes.tap,
            view: owner,
          });
        }
      }

      return;
    }
    case AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED: {
      const lastView = lastFocusedView && lastFocusedView.get();
      if (lastView && owner !== lastView) {
        notifyAccessibilityFocusState(lastView, false, true);
      }

      lastFocusedView = new WeakRef(owner);
      notifyAccessibilityFocusState(owner, true, false);
      return;
    }
    case AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED: {
      const lastView = lastFocusedView && lastFocusedView.get();
      if (lastView && owner === lastView) {
        lastFocusedView = null;
      }

      notifyAccessibilityFocusState(owner, false, true);
      return;
    }
  }
}

export let TNSAccessibilityDelegateCompat: new (owner: TNSView) => AccessibilityDelegateCompat;
export let TNSRecylerViewAccessibilityDelegateCompat: new (owner: TNSView) => RecyclerViewAccessibilityDelegate;
export let TNSRecylerViewAccessibilityItemDelegateCompat: new (
  recyclerViewDelegate: RecyclerViewAccessibilityDelegate,
  owner: TNSView,
) => RecyclerViewAccessibilityItemDelegate;

function ensureDelegates() {
  if (TNSAccessibilityDelegateCompat) {
    return;
  }

  const ButtonClassName = android.widget.Button.class.getName();
  const RadioButtonClassName = android.widget.RadioButton.class.getName();

  class TNSAccessibilityDelegateCompatImpl extends AccessibilityDelegateCompat {
    private readonly owner: WeakRef<TNSView>;

    constructor(owner: TNSView) {
      super();

      this.owner = new WeakRef(owner);

      return global.__native(this);
    }

    public onInitializeAccessibilityNodeInfo(host: AndroidView, info: AccessibilityNodeInfoCompat) {
      super.onInitializeAccessibilityNodeInfo(host, info);

      const owner = this.owner.get();
      if (!owner || !owner.accessibilityComponentType) {
        return;
      }

      switch (owner.accessibilityComponentType) {
        case AccessibilityHelper.BUTTON: {
          info.setClassName(ButtonClassName);
          break;
        }
        case AccessibilityHelper.RADIOBUTTON_CHECKED:
        case AccessibilityHelper.RADIOBUTTON_UNCHECKED: {
          info.setClassName(RadioButtonClassName);
          info.setCheckable(true);
          info.setChecked(owner.accessibilityComponentType === AccessibilityHelper.RADIOBUTTON_CHECKED);
        }
      }
    }

    public sendAccessibilityEvent(host: AndroidViewGroup, eventType: number) {
      super.sendAccessibilityEvent(host, eventType);

      accessibilityEventHelper(this.owner.get(), eventType);
    }
  }

  TNSAccessibilityDelegateCompat = TNSAccessibilityDelegateCompatImpl;

  class TNSRecylerViewAccessibilityDelegateCompatImpl extends RecyclerViewAccessibilityDelegate {
    private readonly owner: WeakRef<TNSView>;

    constructor(owner: TNSView) {
      super();

      this.owner = new WeakRef(owner);

      return global.__native(this);
    }

    public performAccessibilityAction(host: AndroidView, action: number, bundle: AndroidBundle) {
      console.log(`${this}<${this.owner.get()}>.performAccessibilityAction(${host}, ${action}, ${bundle})`);
      return super.performAccessibilityAction(host, action, bundle);
    }
    public onInitializeAccessibilityNodeInfo(host: AndroidView, info: AccessibilityNodeInfoCompat) {
      console.log(`${this}<${this.owner.get()}>.onInitializeAccessibilityNodeInfo(${host}, ${info})`);
      return super.onInitializeAccessibilityNodeInfo(host, info);
    }
    public onInitializeAccessibilityEvent(host: AndroidView, event: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.onInitializeAccessibilityEvent(${host}, ${event})`);
      super.onInitializeAccessibilityEvent(host, event);
    }
    public getItemDelegate() {
      console.log(`${this}<${this.owner.get()}>.getItemDelegate()`);
      return new TNSRecylerViewAccessibilityItemDelegateCompat(this, this.owner.get());
    }
    public dispatchPopulateAccessibilityEvent(host: AndroidView, event: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.dispatchPopulateAccessibilityEvent(${host}, ${event})`);
      return super.dispatchPopulateAccessibilityEvent(host, event);
    }
    public getAccessibilityNodeProvider(host: AndroidView) {
      console.log(`${this}<${this.owner.get()}>.getAccessibilityNodeProvider(${host})`);
      return super.getAccessibilityNodeProvider(host);
    }
    public sendAccessibilityEvent(host: AndroidView, eventType: number) {
      console.log(`${this}<${this.owner.get()}>.sendAccessibilityEvent(${host}, ${eventType})`);
      super.sendAccessibilityEvent(host, eventType);
    }
    public sendAccessibilityEventUnchecked(host: AndroidView, eventType: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.sendAccessibilityEventUnchecked(${host}, ${eventType})`);
      super.sendAccessibilityEventUnchecked(host, eventType);
    }
    public onRequestSendAccessibilityEvent(viewGroup: AndroidViewGroup, host: AndroidView, event: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.onRequestSendAccessibilityEvent(${host}, ${host}, ${event})`);
      return super.onRequestSendAccessibilityEvent(viewGroup, host, event);
    }
    public onPopulateAccessibilityEvent(host: AndroidView, event: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.onPopulateAccessibilityEvent(${host}, ${event})`);
      return super.onPopulateAccessibilityEvent(host, event);
    }
  }

  TNSRecylerViewAccessibilityDelegateCompat = TNSRecylerViewAccessibilityDelegateCompatImpl;

  class TNSRecylerViewAccessibilityItemDelegateCompatImpl extends RecyclerViewAccessibilityItemDelegate {
    private readonly owner: WeakRef<TNSView>;

    constructor(recyclerViewDelegate: RecyclerViewAccessibilityDelegate, owner: TNSView) {
      super(recyclerViewDelegate);

      this.owner = new WeakRef(owner);

      return global.__native(this);
    }

    public performAccessibilityAction(host: AndroidView, action: number, bundle: AndroidBundle) {
      console.log(`${this}<${this.owner.get()}>.performAccessibilityAction(${host}, ${action}, ${bundle})`);
      return super.performAccessibilityAction(host, action, bundle);
    }
    public onInitializeAccessibilityNodeInfo(host: AndroidView, info: AccessibilityNodeInfoCompat) {
      console.log(`${this}<${this.owner.get()}>.onInitializeAccessibilityNodeInfo(${host}, ${info})`);
      return super.onInitializeAccessibilityNodeInfo(host, info);
    }
    public onInitializeAccessibilityEvent(host: AndroidView, event: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.onInitializeAccessibilityEvent(${host}, ${event})`);
      super.onInitializeAccessibilityEvent(host, event);
    }
    public dispatchPopulateAccessibilityEvent(host: AndroidView, event: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.dispatchPopulateAccessibilityEvent(${host}, ${event})`);
      return super.dispatchPopulateAccessibilityEvent(host, event);
    }
    public getAccessibilityNodeProvider(host: AndroidView) {
      console.log(`${this}<${this.owner.get()}>.getAccessibilityNodeProvider(${host})`);
      return super.getAccessibilityNodeProvider(host);
    }
    public sendAccessibilityEvent(host: AndroidView, eventType: number) {
      console.log(`${this}<${this.owner.get()}>.sendAccessibilityEvent(${host}, ${eventType})`);
      super.sendAccessibilityEvent(host, eventType);
    }
    public sendAccessibilityEventUnchecked(host: AndroidView, eventType: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.sendAccessibilityEventUnchecked(${host}, ${eventType})`);
      super.sendAccessibilityEventUnchecked(host, eventType);
    }
    public onRequestSendAccessibilityEvent(viewGroup: AndroidViewGroup, host: AndroidView, event: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.onRequestSendAccessibilityEvent(${host}, ${host}, ${event})`);
      return super.onRequestSendAccessibilityEvent(viewGroup, host, event);
    }
    public onPopulateAccessibilityEvent(host: AndroidView, event: AccessibilityEvent) {
      console.log(`${this}<${this.owner.get()}>.onPopulateAccessibilityEvent(${host}, ${event})`);
      return super.onPopulateAccessibilityEvent(host, event);
    }
  }

  TNSRecylerViewAccessibilityItemDelegateCompat = TNSRecylerViewAccessibilityItemDelegateCompatImpl;
}

let accessibilityEventMap: Map<string, number>;
function ensureAccessibilityEventMap() {
  if (accessibilityEventMap) {
    return;
  }

  accessibilityEventMap = new Map<string, number>([
    /**
     * Invalid selection/focus position.
     */
    ['invalid_position', AccessibilityEvent.INVALID_POSITION],
    /**
     * Maximum length of the text fields.
     */
    ['max_text_length', AccessibilityEvent.MAX_TEXT_LENGTH],
    /**
     * Represents the event of clicking on a android.view.View like android.widget.Button, android.widget.CompoundButton, etc.
     */
    ['view_clicked', AccessibilityEvent.TYPE_VIEW_CLICKED],
    /**
     * Represents the event of long clicking on a android.view.View like android.widget.Button, android.widget.CompoundButton, etc.
     */
    ['view_long_clicked', AccessibilityEvent.TYPE_VIEW_LONG_CLICKED],
    /**
     * Represents the event of selecting an item usually in the context of an android.widget.AdapterView.
     */
    ['view_selected', AccessibilityEvent.TYPE_VIEW_SELECTED],
    /**
     * Represents the event of setting input focus of a android.view.View.
     */
    ['view_focused', AccessibilityEvent.TYPE_VIEW_FOCUSED],
    /**
     * Represents the event of changing the text of an android.widget.EditText.
     */
    ['view_text_changed', AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED],
    /**
     * Represents the event of opening a android.widget.PopupWindow, android.view.Menu, android.app.Dialog, etc.
     */
    ['window_state_changed', AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED],
    /**
     * Represents the event showing a android.app.Notification.
     */
    ['notification_state_changed', AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED],
    /**
     * Represents the event of a hover enter over a android.view.View.
     */
    ['view_hover_enter', AccessibilityEvent.TYPE_VIEW_HOVER_ENTER],
    /**
     * Represents the event of a hover exit over a android.view.View.
     */
    ['view_hover_exit', AccessibilityEvent.TYPE_VIEW_HOVER_EXIT],
    /**
     * Represents the event of starting a touch exploration gesture.
     */
    ['touch_exploration_gesture_start', AccessibilityEvent.TYPE_TOUCH_EXPLORATION_GESTURE_START],
    /**
     * Represents the event of ending a touch exploration gesture.
     */
    ['touch_exploration_gesture_end', AccessibilityEvent.TYPE_TOUCH_EXPLORATION_GESTURE_END],
    /**
     * Represents the event of changing the content of a window and more specifically the sub-tree rooted at the event's source.
     */
    ['window_content_changed', AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED],
    /**
     * Represents the event of scrolling a view.
     */
    ['view_scrolled', AccessibilityEvent.TYPE_VIEW_SCROLLED],
    /**
     * Represents the event of changing the selection in an android.widget.EditText.
     */
    ['view_text_selection_changed', AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED],
    /**
     * Represents the event of an application making an announcement.
     */
    ['announcement', AccessibilityEvent.TYPE_ANNOUNCEMENT],
    /**
     * Represents the event of gaining accessibility focus.
     */
    ['view_accessibility_focused', AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED],
    /**
     * Represents the event of clearing accessibility focus.
     */
    ['view_accessibility_focus_cleared', AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED],
    /**
     * Represents the event of traversing the text of a view at a given movement granularity.
     */
    ['view_text_traversed_at_movement_granularity', AccessibilityEvent.TYPE_VIEW_TEXT_TRAVERSED_AT_MOVEMENT_GRANULARITY],
    /**
     * Represents the event of beginning gesture detection.
     */
    ['gesture_detection_start', AccessibilityEvent.TYPE_GESTURE_DETECTION_START],
    /**
     * Represents the event of ending gesture detection.
     */
    ['gesture_detection_end', AccessibilityEvent.TYPE_GESTURE_DETECTION_END],
    /**
     * Represents the event of the user starting to touch the screen.
     */
    ['touch_interaction_start', AccessibilityEvent.TYPE_TOUCH_INTERACTION_START],
    /**
     * Represents the event of the user ending to touch the screen.
     */
    ['touch_interaction_end', AccessibilityEvent.TYPE_TOUCH_INTERACTION_END],
    /**
     * Mask for AccessibilityEvent all types.
     */
    ['all', AccessibilityEvent.TYPES_ALL_MASK],
  ]);
}

const lastComponentTypeSymbol = Symbol('Android:lastComponentType');

export class AccessibilityHelper {
  public static get BUTTON() {
    return 'button';
  }

  public static get RADIOBUTTON_CHECKED() {
    return 'radiobutton_checked';
  }

  public static get RADIOBUTTON_UNCHECKED() {
    return 'radiobutton_unchecked';
  }

  public static get ACCESSIBLE() {
    return 'accessible';
  }

  public static updateAccessibilityComponentType(tnsView: TNSView, androidView: AndroidView, componentType: string) {
    writeTrace(`updateAccessibilityComponentType: tnsView:${tnsView}, androidView:${androidView} componentType:${componentType}`);

    ensureDelegates();

    if (componentType && androidView[lastComponentTypeSymbol] === componentType) {
      writeTrace(`updateAccessibilityComponentType - ${tnsView} - componentType not changed`);
      return;
    }

    ViewCompat.setAccessibilityDelegate(androidView, new TNSAccessibilityDelegateCompat(tnsView));
    androidView[lastComponentTypeSymbol] = componentType;
  }

  public static removeAccessibilityComponentType(androidView: AndroidView) {
    writeTrace(`removeAccessibilityComponentType from ${androidView}`);

    ViewCompat.setAccessibilityDelegate(androidView, null);
  }

  public static sendAccessibilityEvent(androidView: AndroidView, eventName: string, text?: string) {
    const cls = `AccessibilityHelper.sendAccessibilityEvent(${androidView}, ${eventName}, ${text})`;
    if (!eventName) {
      writeTrace(`${cls}: no eventName provided`);
      return;
    }

    if (!isAccessibilityServiceEnabled()) {
      writeTrace(`${cls} - TalkBack not enabled`);
      return;
    }

    const a11yService = getAccessibilityManager(androidView);
    if (!a11yService.isEnabled()) {
      writeTrace(`${cls} - a11yService not enabled`);
      return;
    }

    ensureAccessibilityEventMap();

    eventName = eventName.toLowerCase();
    if (!accessibilityEventMap.has(eventName)) {
      writeTrace(`${cls} - unknown event`);
      return;
    }
    const eventInt = accessibilityEventMap.get(eventName);

    const a11yEvent = AccessibilityEvent.obtain(eventInt);
    a11yEvent.setSource(androidView);

    a11yEvent.getText().clear();

    if (!text) {
      text = androidView.getContentDescription();
      writeTrace(`${cls} - text not provided use androidView.getContentDescription()`);
    }

    writeTrace(`${cls}: send event with text: '${JSON.stringify(text)}'`);

    if (text) {
      a11yEvent.getText().add(text);
    }

    a11yService.sendAccessibilityEvent(a11yEvent);
  }

  public static updateContentDescription(tnsView: TNSView, androidView: AndroidView) {
    const cls = `AccessibilityHelper.updateContentDescription(${tnsView}, ${androidView}`;

    let contentDescriptionBuilder: string[] = [];
    let haveValue = false;
    if (tnsView.accessibilityLabel) {
      writeTrace(`${cls} - have accessibilityLabel`);
      haveValue = true;
      contentDescriptionBuilder.push(`${tnsView.accessibilityLabel}. `);
    }

    if (tnsView.accessibilityValue) {
      writeTrace(`${cls} - have accessibilityValue`);
      haveValue = true;
      contentDescriptionBuilder.push(`${tnsView.accessibilityValue}. `);
    }

    if (tnsView.accessibilityHint) {
      writeTrace(`${cls} - have accessibilityHint`);
      haveValue = true;
      contentDescriptionBuilder.push(`${tnsView.accessibilityHint}. `);
    }

    const contentDescription = contentDescriptionBuilder
      .join('')
      .trim()
      .replace(/^\.$/, '');

    if (contentDescription !== androidView.getContentDescription()) {
      if (haveValue) {
        writeTrace(`${cls} - set to "${contentDescription}"`);
        androidView.setContentDescription(contentDescription);
      } else {
        writeTrace(`${cls} - remove value`);
        androidView.setContentDescription(null);
      }
    } else {
      writeTrace(`${cls} - no change`);
    }

    return contentDescription;
  }
}

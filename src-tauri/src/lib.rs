mod notes;

use std::{
    str::FromStr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

use serde::Serialize;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    ActivationPolicy, AppHandle, Manager, PhysicalPosition, PhysicalSize, Rect, Runtime,
    WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

const MAIN_WINDOW_LABEL: &str = "main";
const QUIT_MENU_ID: &str = "quit";
const SETTINGS_FILE: &str = "settings.json";
const WINDOW_OPEN_SHORTCUT_KEY: &str = "windowOpenShortcut";
const WINDOW_OPEN_SHORTCUT_ENABLED_KEY: &str = "windowOpenShortcutEnabled";
const DEFAULT_WINDOW_OPEN_SHORTCUT: &str = "Command+Option+D";
const WINDOW_OPEN_SHORTCUT_DISABLED: &str = "off";

struct AutoHideState(AtomicBool);

#[derive(Default)]
struct WindowOpenShortcutRegistration {
    current_shortcut: Option<Shortcut>,
    registration_error: Option<String>,
}

struct WindowOpenShortcutState(Mutex<WindowOpenShortcutRegistration>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowOpenShortcutStatus {
    registration_error: Option<String>,
}

fn window_open_shortcut() -> Shortcut {
    parse_window_open_shortcut(DEFAULT_WINDOW_OPEN_SHORTCUT)
        .expect("default window open shortcut should be valid")
}

#[tauri::command(rename_all = "camelCase")]
fn set_window_auto_hide_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    app.state::<AutoHideState>()
        .0
        .store(enabled, Ordering::Relaxed);
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
fn set_window_open_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    let shortcut = parse_saved_window_open_shortcut(&shortcut)?;
    apply_window_open_shortcut(&app, shortcut)
}

#[tauri::command(rename_all = "camelCase")]
fn get_window_open_shortcut_status(app: AppHandle) -> WindowOpenShortcutStatus {
    let state = app.state::<WindowOpenShortcutState>();
    let registration = state.0.lock().unwrap();

    WindowOpenShortcutStatus {
        registration_error: registration.registration_error.clone(),
    }
}

#[tauri::command(rename_all = "camelCase")]
fn hide_main_window(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(());
    };

    window.hide().map_err(|error| error.to_string())
}

fn position_window_within_monitor<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    monitor_position: PhysicalPosition<i32>,
    monitor_size: PhysicalSize<u32>,
    desired_x: i32,
    desired_y: i32,
) {
    let Ok(window_size) = window.outer_size() else {
        return;
    };

    let monitor_width = monitor_size.width as i32;
    let monitor_height = monitor_size.height as i32;
    let window_width = window_size.width as i32;
    let window_height = window_size.height as i32;

    let max_x = (monitor_position.x + monitor_width - window_width).max(monitor_position.x);
    let max_y = (monitor_position.y + monitor_height - window_height).max(monitor_position.y);
    let x = desired_x.clamp(monitor_position.x, max_x);
    let y = desired_y.clamp(monitor_position.y, max_y);

    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn position_main_window<R: Runtime>(
    app: &AppHandle<R>,
    tray_rect: Option<Rect>,
    click_position: Option<PhysicalPosition<f64>>,
) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let monitor = click_position
        .and_then(|position| {
            window
                .monitor_from_point(position.x, position.y)
                .ok()
                .flatten()
        })
        .or_else(|| {
            tray_rect.and_then(|rect| {
                let position = rect.position.to_physical::<f64>(1.0);
                window
                    .monitor_from_point(position.x, position.y)
                    .ok()
                    .flatten()
            })
        })
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return;
    };

    if let Some(rect) = tray_rect {
        let tray_position = rect.position.to_physical::<f64>(1.0);
        let tray_size = rect.size.to_physical::<f64>(1.0);
        let Ok(window_size) = window.outer_size() else {
            return;
        };

        let desired_x = (tray_position.x + (tray_size.width / 2.0)
            - (window_size.width as f64 / 2.0))
            .round() as i32;
        let desired_y = tray_position.y.round() as i32;

        position_window_within_monitor(
            &window,
            *monitor.position(),
            *monitor.size(),
            desired_x,
            desired_y,
        );
        return;
    }

    let desired_x = monitor.position().x + ((monitor.size().width as i32 - 420) / 2);
    let desired_y = monitor.position().y;
    position_window_within_monitor(
        &window,
        *monitor.position(),
        *monitor.size(),
        desired_x,
        desired_y,
    );
}

fn toggle_main_window<R: Runtime>(
    app: &AppHandle<R>,
    tray_rect: Option<Rect>,
    click_position: Option<PhysicalPosition<f64>>,
) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }

    show_main_window(app, tray_rect, click_position);
}

fn show_main_window<R: Runtime>(
    app: &AppHandle<R>,
    tray_rect: Option<Rect>,
    click_position: Option<PhysicalPosition<f64>>,
) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let is_visible = window.is_visible().unwrap_or(false);

    let _ = window.unminimize();

    if !is_visible {
        position_main_window(app, tray_rect, click_position);
        let _ = window.show();
    }

    let _ = window.set_focus();
}

fn parse_window_open_shortcut(shortcut: &str) -> Result<Shortcut, String> {
    let shortcut = Shortcut::from_str(shortcut)
        .map_err(|_| "Choose a shortcut with modifiers and one key.".to_string())?;

    if shortcut.mods.is_empty() {
        return Err("Choose a shortcut that includes at least one modifier.".to_string());
    }

    Ok(shortcut)
}

fn parse_saved_window_open_shortcut(shortcut: &str) -> Result<Option<Shortcut>, String> {
    if shortcut
        .trim()
        .eq_ignore_ascii_case(WINDOW_OPEN_SHORTCUT_DISABLED)
    {
        return Ok(None);
    }

    parse_window_open_shortcut(shortcut).map(Some)
}

fn window_open_shortcut_registration_error(shortcut: Shortcut) -> String {
    format!(
        "Daily couldn’t use {}. It may already be taken by another app.",
        shortcut.into_string()
    )
}

fn register_window_open_shortcut_handler<R: Runtime>(
    app: &AppHandle<R>,
    shortcut: Shortcut,
) -> Result<(), String> {
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _, event| {
            if event.state == ShortcutState::Pressed {
                show_main_window(app, None, None);
            }
        })
        .map_err(|_| window_open_shortcut_registration_error(shortcut))
}

fn apply_window_open_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    shortcut: Option<Shortcut>,
) -> Result<(), String> {
    let state = app.state::<WindowOpenShortcutState>();
    let mut registration = state.0.lock().unwrap();

    if registration.current_shortcut.as_ref().map(Shortcut::id)
        == shortcut.as_ref().map(Shortcut::id)
    {
        return Ok(());
    }

    let previous_shortcut = registration.current_shortcut;

    if let Some(previous_shortcut) = previous_shortcut {
        if let Err(error) = app.global_shortcut().unregister(previous_shortcut) {
            let error = error.to_string();
            registration.registration_error = Some(error.clone());
            return Err(error);
        }
    }

    if let Some(shortcut) = shortcut {
        if let Err(error) = register_window_open_shortcut_handler(app, shortcut) {
            if let Some(previous_shortcut) = previous_shortcut {
                if register_window_open_shortcut_handler(app, previous_shortcut).is_ok() {
                    registration.current_shortcut = Some(previous_shortcut);
                }
            }

            registration.registration_error = Some(error.clone());
            return Err(error);
        }

        registration.current_shortcut = Some(shortcut);
        registration.registration_error = None;
        return Ok(());
    }

    registration.current_shortcut = None;
    registration.registration_error = None;
    Ok(())
}

fn saved_window_open_shortcut<R: Runtime>(app: &AppHandle<R>) -> Option<Shortcut> {
    let (saved_enabled, saved_shortcut) = app
        .store(SETTINGS_FILE)
        .ok()
        .map(|store| {
            let enabled = store
                .get(WINDOW_OPEN_SHORTCUT_ENABLED_KEY)
                .and_then(|value| value.as_bool());
            let shortcut = store
                .get(WINDOW_OPEN_SHORTCUT_KEY)
                .and_then(|value| value.as_str().map(str::to_owned));

            (enabled, shortcut)
        })
        .unwrap_or((None, None));

    if saved_enabled == Some(false) {
        return None;
    }

    let Some(saved_shortcut) = saved_shortcut else {
        return Some(window_open_shortcut());
    };

    match parse_saved_window_open_shortcut(&saved_shortcut) {
        Ok(shortcut) => shortcut,
        Err(error) => {
            log::warn!(
                "Failed to parse saved window shortcut {}: {}",
                saved_shortcut,
                error
            );
            Some(window_open_shortcut())
        }
    }
}

fn initialize_window_open_shortcut<R: Runtime>(app: &AppHandle<R>) {
    let shortcut = saved_window_open_shortcut(app);

    if let Err(error) = apply_window_open_shortcut(app, shortcut) {
        log::warn!("Failed to register global shortcut: {}", error);
    }
}

fn build_tray<R: Runtime>(app: &mut tauri::App<R>) -> tauri::Result<()> {
    let quit_item = MenuItem::with_id(app, QUIT_MENU_ID, "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit_item])?;

    let mut tray_builder = TrayIconBuilder::with_id("daily-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Daily");

    #[cfg(target_os = "macos")]
    {
        let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;
        tray_builder = tray_builder.icon(tray_icon).icon_as_template(true);
    }

    #[cfg(not(target_os = "macos"))]
    if let Some(icon) = app.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(icon);
    }

    tray_builder
        .on_menu_event(|app, event| {
            if event.id.as_ref() == QUIT_MENU_ID {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                rect,
                position,
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle(), Some(rect), Some(position));
            }
        })
        .build(app)?;

    Ok(())
}

fn build_app_menu<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let edit_menu = Submenu::with_items(
        app_handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app_handle, None)?,
            &PredefinedMenuItem::redo(app_handle, None)?,
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::cut(app_handle, None)?,
            &PredefinedMenuItem::copy(app_handle, None)?,
            &PredefinedMenuItem::paste(app_handle, None)?,
            &PredefinedMenuItem::select_all(app_handle, None)?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::with_items(
            app_handle,
            app_handle.package_info().name.clone(),
            true,
            &[&PredefinedMenuItem::quit(app_handle, None)?],
        )?;

        return Menu::with_items(app_handle, &[&app_menu, &edit_menu]);
    }

    #[cfg(not(target_os = "macos"))]
    Menu::with_items(app_handle, &[&edit_menu])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .enable_macos_default_menu(false)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AutoHideState(AtomicBool::new(true)))
        .manage(WindowOpenShortcutState(Mutex::new(
            WindowOpenShortcutRegistration::default(),
        )))
        .manage(notes::NotebookFolderState::default())
        .invoke_handler(tauri::generate_handler![
            set_window_auto_hide_enabled,
            set_window_open_shortcut,
            get_window_open_shortcut_status,
            hide_main_window,
            notes::set_notebook_folder,
            notes::open_or_create_today_note,
            notes::open_or_create_note_for_date,
            notes::find_existing_note_dates,
            notes::save_daily_note,
            notes::open_note_in_default_app,
            notes::open_note_in_finder
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(ActivationPolicy::Accessory);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            let menu = build_app_menu(app.handle())?;
            app.handle().set_menu(menu)?;

            initialize_window_open_shortcut(app.handle());
            build_tray(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW_LABEL {
                return;
            }

            if let WindowEvent::Focused(false) = event {
                let auto_hide_enabled = window
                    .app_handle()
                    .state::<AutoHideState>()
                    .0
                    .load(Ordering::Relaxed);

                if auto_hide_enabled {
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

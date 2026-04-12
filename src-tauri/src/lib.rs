mod notes;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    ActivationPolicy, AppHandle, Manager, PhysicalPosition, PhysicalSize, Rect, Runtime,
    WindowEvent,
};

const MAIN_WINDOW_LABEL: &str = "main";
const QUIT_MENU_ID: &str = "quit";

struct AutoHideState(AtomicBool);

#[tauri::command(rename_all = "camelCase")]
fn set_window_auto_hide_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    app.state::<AutoHideState>()
        .0
        .store(enabled, Ordering::Relaxed);
    Ok(())
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

    let _ = window.unminimize();
    position_main_window(app, tray_rect, click_position);
    let _ = window.show();
    let _ = window.set_focus();
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .enable_macos_default_menu(false)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AutoHideState(AtomicBool::new(true)))
        .manage(notes::PrimaryFolderState::default())
        .invoke_handler(tauri::generate_handler![
            set_window_auto_hide_enabled,
            notes::set_primary_folder,
            notes::open_or_create_today_note,
            notes::open_or_create_note_for_date,
            notes::find_existing_note_dates,
            notes::save_daily_note,
            notes::open_in_finder
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

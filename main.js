/*
Vera adapter for ioBroker
Pavel Pyatovsky
Pyatovsky.SmartHome@gmail.com
 */

// Вызывает обязательный файл)
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils

// Обязательно - создает адаптер (объект)
var adapter = utils.adapter('vera');

var request = require('request');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
  try {
    adapter.log.info('cleaned everything up...');
    callback();
  } catch (e) {
    callback();
  }
});

var devicesFastAcs = new Array() // Массив для быстрого доступа к устройствам (тестовый)

//Функция запустить сцену - отослать команду
function httpRunScene(SID) {
  request('http://' + adapter.config.IP + ':3480/data_request?id=action&serviceId=urn:micasaverde-com:serviceId:HomeAutomationGateway1&action=RunScene&SceneNum=' + SID);
}

//Функция для переключения выключателя - отослать команду
function httpTurnSwitch(DID, SID, mes) {
  request('http://' + adapter.config.IP + ':3480/data_request?id=action&DeviceNum=' + DID + '&serviceId=' + SID + '&action=SetTarget&newTargetValue=' + mes);
}

function httpTurnDimmer(DID, SID, mes) {
  request('http://' + adapter.config.IP + ':3480/data_request?id=lu_action&DeviceNum=' + DID + '&action=SetLoadLevelTarget&serviceId=' + SID + '&newLoadlevelTarget=' + mes);
}

//Подписываемся на случай изменения состояния (событие stateChange)
adapter.on('stateChange', StateProcessing);

function StateProcessing(id, state) {
  if (state.ack === true) //Если получено в результате опроса
  {

  } else if (state.ack === false) //Если это команды  
  {
    if (id.includes("scene") && state.val === true) //Если это сцена
    {
      adapter.getObject(id, function (err, obj) {
        httpRunScene(obj.native.veraSceneID);
      });
      adapter.setState(id, false, true); //Переводим кнопку в выключенное состояние ("режим кнопки")
      adapter.log.info(adapter.config.comment + ' ran the scene ' + id);
    }

    if (id.includes("general_switch")) //Если это обычный выключатель
    {
      adapter.getObject(id, function (err, obj) {
        httpTurnSwitch(obj.native.veraDeviceID, "urn:upnp-org:serviceId:SwitchPower1", (+state.val));
      });
      adapter.log.info(adapter.config.comment + ' sent ' + state.val + ' to ' + id);
    }
    if (id.includes("general_dimmer") || id.includes("general_window")) //Если диммер
    {
      adapter.getObject(id, function (err, obj) {
        httpTurnDimmer(obj.native.veraDeviceID, "urn:upnp-org:serviceId:Dimming1", (+state.val));
      });
      adapter.log.info(adapter.config.comment + ' sent ' + state.val + ' to ' + id);
    }
    if (id.includes("general_window")) //Если диммер
    {
      adapter.getObject(id, function (err, obj) {
        httpTurnDimmer(obj.native.veraDeviceID, "urn:upnp-org:serviceId:Dimming1", (+state.val));
      });
      adapter.log.info(adapter.config.comment + ' sent ' + state.val + ' to ' + id);
    }

    if (id.includes("virtual_switch")) //Если это виртуальный выключатель
    {
      adapter.getObject(id, function (err, obj) {
        httpTurnSwitch(obj.native.veraDeviceID, "urn:upnp-org:serviceId:VSwitch1", (+state.val));
      });
      adapter.log.info(adapter.config.comment + ' sent ' + state.val + ' to ' + id);
    }
  }
}

// Драйвер стартует и вызывает функцию main
adapter.on('ready', function () {
  main();
});

// ========== ОПРОС И ОБРАБОТКА ОПРОСА ==========
// Обработка информации, полученной в результате периодического опроса
function statusProcessing(error, response, body) {
  if (!error && response.statusCode == 200) {
    adapter.setState('info.connection', true, true);
    var obj = JSON.parse(body); // Конвертируем просто текст в объект
    for (var i = 0; i < devicesFastAcs.length; ++i) // Просматриваем весь наш массив, содержащий ID устройств в Вере
    {
      for (var ii = 0; ii < obj.devices.length; ++ii) // Ищем их по всему полученному массиву
      {
        if (devicesFastAcs[i].veraDeviceID == obj.devices[ii].id) // Сравниваем ID из нашего массива с теми что есть в полученном массиве
        {
          if (devicesFastAcs[i].deviceType == "general_switch") // Если это выключатель
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "Status") // Переменную, которая называется Status
              {
                adapter.setState('general_switch_' + devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_flood") // Если это датчик протечки
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "Tripped") // Переменную, которая называется Status
              {
                adapter.setState('general_flood_' + devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_motion") // Если это датчик движения
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "Tripped") // Переменную, которая называется Status
              {
                adapter.setState('general_motion_' + devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_combo") // Если это датчик движения
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "Tripped") // Переменную, которая называется Status
              {
                adapter.setState('general_combo_' + devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_door") // Если это датчик двери
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "ArmedTripped") // Переменную, которая называется Status
              {
                adapter.setState('general_door_' + devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
              if (obj.devices[ii].states[iii].variable == "Armed") // Переменную, которая называется Status
              {
                adapter.setState('general_door_armed_' + devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_light") // Если это датчик движения
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "CurrentLevel") // Переменную, которая называется Status
              {
                adapter.setState('general_light_' + devicesFastAcs[i].veraDeviceID, Number(obj.devices[ii].states[iii].value), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_humidity") // Если это датчик влажности
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "CurrentLevel") // Переменную, которая называется Status
              {
                adapter.setState('general_humidity_' + devicesFastAcs[i].veraDeviceID, Number(obj.devices[ii].states[iii].value), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_heater") // Если это термостат
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "SetpointTarget") // Переменную, которая называется Status
              {
                adapter.setState('general_heater_' + devicesFastAcs[i].veraDeviceID, Number(obj.devices[ii].states[iii].value), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_window") // Если это термостат
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "LoadLevelStatus") // Переменную, которая называется Status
              {
                adapter.setState('general_window_' + devicesFastAcs[i].veraDeviceID, Number(obj.devices[ii].states[iii].value), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_smoke") // Если это датчик дыма
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "Status" || obj.devices[ii].states[iii].variable == "ArmedTripped") // Переменную, которая называется Status
              {
                adapter.setState('general_smoke_' + devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_dimmer") // Если это диммер
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "LoadLevelStatus") // Переменную, которая называется Status
              {
                adapter.setState('general_dimmer_' + devicesFastAcs[i].veraDeviceID, obj.devices[ii].states[iii].value, true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "virtual_switch") // Если это виртуальный выключатель
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "Status" && obj.devices[ii].states[iii].service == "urn:upnp-org:serviceId:VSwitch1") // Переменную, которая называется Status, сервис urn:upnp-org:serviceId:VSwitch1
              {
                adapter.setState('virtual_switch_' + devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          } else if (devicesFastAcs[i].deviceType == "general_temperature_sensor" || devicesFastAcs[i].deviceType == "vera_temperature_sensor") // Если это датчик температуры или виртуальный датчик температуры
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "CurrentTemperature") // Переменную, которая называется CurrentTemperature
              {
                adapter.setState(devicesFastAcs[i].deviceType + '_' + devicesFastAcs[i].veraDeviceID, parseFloat(obj.devices[ii].states[iii].value), true);
              }
            }
          }
        }
      }
    }
  } else {
    adapter.setState('info.connection', false, true);
  }

}

// Главная периодическая функция (опрос)
function mainPoll() {
  request('http://' + adapter.config.IP + ':3480/data_request?id=status', statusProcessing);
}
// ========== КОНЕЦ ОПРОСА И ОБРАБОТКИ ==========


// ========== СОЗДАНИЕ УСТРОЙСТВ ==========
function createRooms(obj) // Комнаты
{
  for (var i = 0; i < obj.rooms.length; ++i) {
    adapter.setForeignObject('enum.rooms.' + obj.rooms[i].name.toLowerCase().replace(/ /g, '_'), {
      type: 'enum',
      common: {
        name: obj.rooms[i].name,
        members: []
      },
      native: {
        veraRoomID: obj.rooms[i].id
      }
    });

    adapter.log.info(adapter.config.comment + ' created ROOM ' + obj.rooms[i].name);
  }
}

function createScenes(obj) // Сцены
{
  for (var i = 0; i < obj.scenes.length; ++i) {
    adapter.setObject('scene.' + obj.scenes[i].name.toLowerCase().replace(/ /g, '_'), {
      type: 'state',
      common: {
        name: obj.scenes[i].name,
        type: 'button',
        role: 'boolean',
        read: 'true',
        write: 'true'
      },
      native: {
        veraSceneID: obj.scenes[i].id
      }
    });
    adapter.setState('scene.' + obj.scenes[i].name.toLowerCase().replace(/ /g, '_'), false, true); //Делаем нулем
    adapter.log.info(adapter.config.comment + ' created SCENE ' + obj.scenes[i].name);
  }
}

function lookForDevices(obj) // Ищем все устройства
{
  for (var i = 0; i < obj.devices.length; ++i) {
    if (obj.devices[i].category_num == "3") // Если это выключатель (известна его категория = 3)
    {
      adapter.setObject('general_switch_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'boolean',
          role: 'switch',
          read: 'true',
          write: 'true'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_switch'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_switch"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL SWITCH ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }

    if (obj.devices[i].device_type == "urn:schemas-micasaverde-com:device:FloodSensor:1") // Датчик протечки
    {
      adapter.setObject('general_flood_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'boolean',
          role: 'indicator',
          read: 'true',
          write: 'false'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_flood'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_flood"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL FLOOD ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
    if (obj.devices[i].device_type == "urn:schemas-micasaverde-com:device:DoorSensor:1") // Датчик двери (но это не точно )
    {
      adapter.setObject('general_door_armed_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'boolean',
          role: 'indicator',
          read: 'true',
          write: 'false'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_door'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_door"
      }); // Вносим запись в массив быстрого доступа      
      adapter.log.info(adapter.config.comment + ' created GENERAL FLOOD ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);


      adapter.setObject('general_door_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'boolean',
          role: 'indicator',
          read: 'true',
          write: 'false'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_door'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_door"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL FLOOD ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
    if (obj.devices[i].device_type == "urn:schemas-micasaverde-com:device:ComboDevice:1") // Датчик двери (но это не точно )
    {
      adapter.setObject('general_combo_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'boolean',
          role: 'indicator',
          read: 'true',
          write: 'false'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_combo'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_combo"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL FLOOD ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
    if (obj.devices[i].device_type == "urn:schemas-micasaverde-com:device:LightSensor:1") // Датчик освещения
    {
      adapter.setObject('general_light_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'number',
          role: 'indicator',
          read: 'true',
          write: 'false'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_light'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_light"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL LIGHT ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
    if (obj.devices[i].device_type == "urn:schemas-micasaverde-com:device:HumiditySensor:1") // Датчик влажности
    {
      adapter.setObject('general_humidity_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'number',
          role: 'indicator',
          read: 'true',
          write: 'false'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_humidity'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_humidity"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL HUMIDITY ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
    if (obj.devices[i].device_type == "urn:schemas-upnp-org:device:Heater:1") // Термостат
    {
      adapter.setObject('general_heater_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'number',
          role: 'value',
          read: 'true',
          write: 'true'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_heater'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_heater"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL HEATER ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
    if (obj.devices[i].device_type == "urn:schemas-micasaverde-com:device:WindowCovering:1") // Термостат
    {
      adapter.setObject('general_window_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'number',
          role: 'value',
          read: 'true',
          write: 'true'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_window'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_window"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL WINDOW ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
    if (obj.devices[i].device_type == "urn:schemas-micasaverde-com:device:SmokeSensor:1") // Датчик протечки
    {
      adapter.setObject('general_smoke_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'boolean',
          role: 'indicator',
          read: 'true',
          write: 'false'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_smoke'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_smoke"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL SMOKE ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
    if (obj.devices[i].device_type == "urn:schemas-micasaverde-com:device:MotionSensor:1") // Датчик движения
    {
      adapter.setObject('general_motion_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'boolean',
          role: 'indicator',
          read: 'true',
          write: 'false'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_motion'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_motion"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL MOTION ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }

    if (obj.devices[i].category_num == "2") // Если это диммер (известна его категория = 2)
    {
      adapter.setObject('general_dimmer_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'number',
          role: 'dimmer',
          read: 'true',
          write: 'true'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_dimmer'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_dimmer"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL DIMMER ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }

    if (obj.devices[i].category_num == "17") // Если это датчик температуры (известна его категория = 17)
    {
      adapter.setObject('general_temperature_sensor_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'number',
          role: 'value.temperature',
          read: 'true',
          unit: '°C'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceCategory: obj.devices[i].category_num,
          deviceType: 'general_temperature_sensor'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "general_temperature_sensor"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created GENERAL TEMPERATURE SENSOR ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }

    // Пытаемся определить по типу
    if (obj.devices[i].device_type == "urn:schemas-upnp-org:device:VSwitch:1") // Если это виртуальный выключатель (плагин Virtual ON/OFF Switches - App id: 1408)
    {
      adapter.setObject('virtual_switch_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'boolean',
          role: 'switch',
          read: 'true',
          write: 'true'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceType: obj.devices[i].device_type,
          deviceType: 'virtual_switch'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "virtual_switch"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created VIRTUAL SWITCH ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }

    // Пытаемся определить по файлу
    if (obj.devices[i].device_file == "D_VirtualOutdoorTemperature1.xml") // Если это виртуальный температурный датчик Веры (плагин Virtual Outdoor Temperature Plugin (by MiOS) - App id: 8671)
    {
      adapter.setObject('vera_temperature_sensor_' + obj.devices[i].id, {
        type: 'state',
        common: {
          name: obj.devices[i].name,
          type: 'number',
          role: 'value.temperature',
          read: 'true',
          unit: '°C'
        },
        native: {
          veraDeviceID: obj.devices[i].id,
          veraDeviceFile: obj.devices[i].device_file,
          deviceType: 'vera_temperature_sensor'
        }
      });
      devicesFastAcs.push({
        veraDeviceID: obj.devices[i].id,
        deviceType: "vera_temperature_sensor"
      }); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment + ' created VERA TEMPERATURE SENSOR ' + obj.devices[i].name + ' for ID ' + obj.devices[i].id);
    }
  }
}

// Функция для начального создания устройств
function findAndCreateDevices() {
  request('http://' + adapter.config.IP + ':3480/data_request?id=user_data', function (error, response, body) {
    var obj = JSON.parse(body);
    if (adapter.config.enableRooms === true) {
      createRooms(obj);
    }
    if (adapter.config.enableScenes === true) {
      createScenes(obj);
    }
    // Ищем устройства
    lookForDevices(obj);
  });
}
// ========== КОНЕЦ СОЗДАНИЯ УСТРОЙСТВ ==========


// Функция, которая стартует
function main() {
  // Переменная для отображения статуса соединения
  adapter.setState('info.connection', false, true);

  // Функция для поиска и создания устройств при запуске
  findAndCreateDevices()

  // Запускаем опрос с определенным периодом
  var timerID = setInterval(mainPoll, adapter.config.period);

  // Подписываемся на состояния объектов
  if (adapter.config.enableScenes === true) {
    adapter.subscribeStates('*scene*');
  }

  adapter.subscribeStates('*switch*');
  adapter.subscribeStates('*dimmer*');
  adapter.subscribeStates('*window*');

  // Информация при старте
  adapter.log.info(adapter.config.comment + ' starts with: IP - ' + adapter.config.IP + '; Period - ' + adapter.config.period);

}

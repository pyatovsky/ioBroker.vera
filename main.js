/*
Vera adapter for ioBroker
Pavel Pyatovsky
Pyatovsky.SmartHome@gmail.com
 */

// Вызывает обязательный файл)
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

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
function httpRunScene (SID)
{
	request ('http://'+adapter.config.IP+':3480/data_request?id=action&serviceId=urn:micasaverde-com:serviceId:HomeAutomationGateway1&action=RunScene&SceneNum='+SID);
}

//Функция для переключения выключателя - отослать команду
function httpTurnSwitch (DID, SID, mes)
{
	request ('http://'+adapter.config.IP+':3480/data_request?id=action&DeviceNum='+DID+'&serviceId='+SID+'&action=SetTarget&newTargetValue='+mes);
}

//Подписываемся на случай изменения состояния (событие stateChange)
adapter.on('stateChange', StateProcessing);

function StateProcessing(id, state)
{
	if (state.ack === true) //Если получено в результате опроса
	{

	}

	else if (state.ack === false) //Если это команды
	{
		if (id.includes("scene") && state.val === true) //Если это сцена
		{
			adapter.getObject(id, function (err, obj) {
			httpRunScene (obj.native.veraSceneID);
			});
			adapter.setState(id, false, true); //Переводим кнопку в выключенное состояние ("режим кнопки")
			adapter.log.info(adapter.config.comment+' ran the scene '+id);
		}

		if (id.includes("general_switch")) //Если это обычный выключатель
		{
			adapter.getObject(id, function (err, obj) {
			httpTurnSwitch (obj.native.veraDeviceID, "urn:upnp-org:serviceId:SwitchPower1", (+state.val));
			});
			adapter.log.info(adapter.config.comment+' sent '+state.val+' to '+id);
		}

    if (id.includes("virtual_switch")) //Если это виртуальный выключатель
		{
			adapter.getObject(id, function (err, obj) {
			httpTurnSwitch (obj.native.veraDeviceID, "urn:upnp-org:serviceId:VSwitch1", (+state.val));
			});
			adapter.log.info(adapter.config.comment+' sent '+state.val+' to '+id);
		}
	}
}

// Драйвер стартует и вызывает функцию main
adapter.on('ready', function () {
    main();
});

// ========== ОПРОС И ОБРАБОТКА ОПРОСА ==========
// Обработка информации, полученной в результате периодического опроса
function statusProcessing (error, response, body)
{
  if (!error && response.statusCode == 200)
  {
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
                adapter.setState('general_switch_'+devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          }
          else if (devicesFastAcs[i].deviceType == "virtual_switch") // Если это виртуальный выключатель
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "Status" && obj.devices[ii].states[iii].service == "urn:upnp-org:serviceId:VSwitch1") // Переменную, которая называется Status, сервис urn:upnp-org:serviceId:VSwitch1
              {
                adapter.setState('virtual_switch_'+devicesFastAcs[i].veraDeviceID, Boolean(Number(obj.devices[ii].states[iii].value)), true);
              }
            }
          }
          else if (devicesFastAcs[i].deviceType == "general_temperature_sensor" || devicesFastAcs[i].deviceType == "vera_temperature_sensor") // Если это датчик температуры или виртуальный датчик температуры
          {
            for (var iii = 0; iii < obj.devices[ii].states.length; ++iii) // Ищем в массиве этого устройства
            {
              if (obj.devices[ii].states[iii].variable == "CurrentTemperature") // Переменную, которая называется CurrentTemperature
              {
                adapter.setState(devicesFastAcs[i].deviceType+'_'+devicesFastAcs[i].veraDeviceID, parseFloat(obj.devices[ii].states[iii].value), true);
              }
            }
          }
        }
      }
    }
  }

  else
  {
    adapter.setState('info.connection', false, true);
  }

}

// Главная периодическая функция (опрос)
function mainPoll ()
{
  request ('http://'+adapter.config.IP+':3480/data_request?id=status', statusProcessing);
}
// ========== КОНЕЦ ОПРОСА И ОБРАБОТКИ ==========


// ========== СОЗДАНИЕ УСТРОЙСТВ ==========
function createRooms(obj) // Комнаты
{
	for (var i = 0; i< obj.rooms.length; ++i)
	{
		adapter.setForeignObject('enum.rooms.'+obj.rooms[i].name.toLowerCase().replace(/ /g, '_'),{
		type: 'enum',
			common: {
			name: obj.rooms[i].name,
			members: []
			},
			native: {
			veraRoomID: obj.rooms[i].id
			}
		});

		adapter.log.info(adapter.config.comment+' created ROOM '+obj.rooms[i].name);
	}
}

function createScenes(obj) // Сцены
{
	for (var i = 0; i< obj.scenes.length; ++i)
	{
		adapter.setObject('scene.'+obj.scenes[i].name.toLowerCase().replace(/ /g, '_'),{
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
		adapter.setState('scene.'+obj.scenes[i].name.toLowerCase().replace(/ /g, '_'), false, true); //Делаем нулем
		adapter.log.info(adapter.config.comment+' created SCENE '+obj.scenes[i].name);
	}
}

function lookForDevices(obj) // Ищем все устройства
{
  for (var i = 0; i< obj.devices.length; ++i)
  {
		if (obj.devices[i].category_num == "3") // Если это выключатель (известна его категория = 3)
		{
			adapter.setObject('general_switch_'+obj.devices[i].id,{
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
      devicesFastAcs.push({veraDeviceID: obj.devices[i].id, deviceType: "general_switch"}); // Вносим запись в массив быстрого доступа
			adapter.log.info(adapter.config.comment+' created GENERAL SWITCH '+obj.devices[i].name+ ' for ID ' + obj.devices[i].id);
		}

		if (obj.devices[i].category_num == "17") // Если это датчик температуры (известна его категория = 17)
		{
      adapter.setObject('general_temperature_sensor_'+obj.devices[i].id, {
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
      devicesFastAcs.push({veraDeviceID: obj.devices[i].id, deviceType: "general_temperature_sensor"}); // Вносим запись в массив быстрого доступа
      adapter.log.info(adapter.config.comment+' created GENERAL TEMPERATURE SENSOR '+obj.devices[i].name+ ' for ID ' + obj.devices[i].id);
		}

    // Пытаемся определить по типу
    if (obj.devices[i].device_type == "urn:schemas-upnp-org:device:VSwitch:1") // Если это виртуальный выключатель (плагин Virtual ON/OFF Switches - App id: 1408)
    {
      adapter.setObject('virtual_switch_'+obj.devices[i].id,{
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
        devicesFastAcs.push({veraDeviceID: obj.devices[i].id, deviceType: "virtual_switch"}); // Вносим запись в массив быстрого доступа
        adapter.log.info(adapter.config.comment+' created VIRTUAL SWITCH '+obj.devices[i].name+ ' for ID ' + obj.devices[i].id);
      }

      // Пытаемся определить по файлу
      if (obj.devices[i].device_file == "D_VirtualOutdoorTemperature1.xml") // Если это виртуальный температурный датчик Веры (плагин Virtual Outdoor Temperature Plugin (by MiOS) - App id: 8671)
      {
        adapter.setObject('vera_temperature_sensor_'+obj.devices[i].id,{
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
          devicesFastAcs.push({veraDeviceID: obj.devices[i].id, deviceType: "vera_temperature_sensor"}); // Вносим запись в массив быстрого доступа
          adapter.log.info(adapter.config.comment+' created VERA TEMPERATURE SENSOR '+obj.devices[i].name+ ' for ID ' + obj.devices[i].id);
        }
	}
}

// Функция для начального создания устройств
function findAndCreateDevices ()
{
  request ('http://'+adapter.config.IP+':3480/data_request?id=user_data', function (error, response, body)
    {
    	var obj = JSON.parse(body);
    	if (adapter.config.enableRooms === true)
    	{
    		createRooms(obj);
    	}
    	if (adapter.config.enableScenes === true)
    	{
    		createScenes(obj);
    	}
    	// Ищем устройства
    	lookForDevices(obj);
    }
  );
}
// ========== КОНЕЦ СОЗДАНИЯ УСТРОЙСТВ ==========


// Функция, которая стартует
function main()
{
	// Переменная для отображения статуса соединения
	adapter.setState('info.connection', false, true);

  // Функция для поиска и создания устройств при запуске
  findAndCreateDevices ()

	// Запускаем опрос с определенным периодом
	var timerID = setInterval(mainPoll, adapter.config.period);

	// Подписываемся на состояния объектов
	if (adapter.config.enableScenes === true)
	{
		adapter.subscribeStates('*scene*');
	}

	adapter.subscribeStates('*switch*');

  // Информация при старте
  adapter.log.info(adapter.config.comment+' starts with: IP - '+adapter.config.IP+'; Period - '+adapter.config.period);

}

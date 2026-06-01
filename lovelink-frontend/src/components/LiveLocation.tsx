import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Heart, ShieldAlert, PowerOff, Battery, BatteryCharging, MapPin, Clock } from 'lucide-react';
import apiClient from '../services/apiClient';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const partnerIcon = L.divIcon({
  html: `<div class="bg-pink-500 p-2 rounded-full shadow-lg text-white border-2 border-white animate-pulse"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const myIcon = L.divIcon({
  html: `<div class="bg-blue-500 p-2 rounded-full shadow-lg text-white border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-navigation"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const RecenterMap = ({ coords }: { coords: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, map.getZoom());
  }, [coords, map]);
  return null;
};

export const LiveLocation = () => {
  // 🌟 NÂNG CẤP: Khởi tạo tất cả trạng thái từ localStorage để chống mất dữ liệu khi F5
  const [myCoords, setMyCoords] = useState<[number, number] | null>(() => {
    const saved = localStorage.getItem('myLastCoords');
    return saved ? JSON.parse(saved) : null;
  });
  const [partnerCoords, setPartnerCoords] = useState<[number, number] | null>(() => {
    const saved = localStorage.getItem('partnerLastCoords');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [myBattery, setMyBattery] = useState<{ level: number; isCharging: boolean } | null>(null);
  const [partnerBattery, setPartnerBattery] = useState<{ level: number; isCharging: boolean } | null>(null);
  
  const [myAddress, setMyAddress] = useState<string>(() => {
    return localStorage.getItem('myAddress') || 'Chưa bật định vị';
  });
  const [partnerAddress, setPartnerAddress] = useState<string>(() => {
    return localStorage.getItem('partnerAddress') || 'Ngoại tuyến';
  });

  const [myStationarySince, setMyStationarySince] = useState<number | null>(() => {
    const saved = localStorage.getItem('myStationarySince');
    return saved ? parseInt(saved, 10) : null;
  });
  const [partnerStationarySince, setPartnerStationarySince] = useState<number | null>(() => {
    const saved = localStorage.getItem('partnerStationarySince');
    return saved ? parseInt(saved, 10) : null;
  });

  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  const [isSharing, setIsSharing] = useState(() => {
    const saved = localStorage.getItem('isSharingLocation');
    return saved === 'true';
  });
  const [errorMsg, setErrorMsg] = useState('');
  
  const myCoordsRef = useRef(myCoords);
  const myBatteryRef = useRef(myBattery);
  const isSharingRef = useRef(isSharing);
  const lastSentTime = useRef(0);

  const lastFetchedMyCoords = useRef<[number, number] | null>(myCoords);
  const lastFetchedPartnerCoords = useRef<[number, number] | null>(partnerCoords);
  const myStationarySinceRef = useRef<number | null>(myStationarySince);

  useEffect(() => { myCoordsRef.current = myCoords; }, [myCoords]);
  useEffect(() => { myBatteryRef.current = myBattery; }, [myBattery]);
  useEffect(() => { 
    isSharingRef.current = isSharing; 
    localStorage.setItem('isSharingLocation', isSharing.toString());
  }, [isSharing]);

  // Cập nhật bộ đếm thời gian thực tế mỗi phút để tính toán "ở đây bao lâu"
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Định dạng thời gian dừng chân kiểu Zenly
  const formatIdleTime = (timestamp: number | null) => {
    if (!timestamp) return '';
    const diffMins = Math.floor((currentTime - timestamp) / 60000);
    if (diffMins < 1) return 'Vừa mới tới';
    if (diffMins < 60) return `Đã ở đây ${diffMins} phút`;
    const hours = Math.floor(diffMins / 60);
    const remainMins = diffMins % 60;
    return remainMins > 0 ? `Đã ở đây ${hours} giờ ${remainMins} phút` : `Đã ở đây ${hours} giờ`;
  };

  const fetchAddressName = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`, {
        headers: { 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8' }
      });
      const data = await response.json();
      if (data) {
        if (data.name) {
          const street = data.address?.road || data.address?.suburb || '';
          return street ? `${data.name}, ${street}` : data.name;
        } else if (data.display_name) {
          const parts = data.display_name.split(',');
          return parts.length > 3 ? parts.slice(0, 3).join(',').trim() : data.display_name;
        }
      }
      return 'Không rõ địa danh';
    } catch (err) {
      return 'Đang tải vị trí...';
    }
  };

  useEffect(() => {
    if (!myCoords || !isSharing) return;
    if (lastFetchedMyCoords.current) {
      const delta = Math.abs(myCoords[0] - lastFetchedMyCoords.current[0]) + Math.abs(myCoords[1] - lastFetchedMyCoords.current[1]);
      if (delta < 0.0003) return;
    }
    fetchAddressName(myCoords[0], myCoords[1]).then(addr => {
      setMyAddress(addr);
      localStorage.setItem('myAddress', addr);
      lastFetchedMyCoords.current = myCoords;
    });
  }, [myCoords, isSharing]);

  useEffect(() => {
    if (!partnerCoords) return;
    if (lastFetchedPartnerCoords.current) {
      const delta = Math.abs(partnerCoords[0] - lastFetchedPartnerCoords.current[0]) + Math.abs(partnerCoords[1] - lastFetchedPartnerCoords.current[1]);
      if (delta < 0.0003) return;
    }
    fetchAddressName(partnerCoords[0], partnerCoords[1]).then(addr => {
      setPartnerAddress(addr);
      localStorage.setItem('partnerAddress', addr);
      lastFetchedPartnerCoords.current = partnerCoords;
    });
  }, [partnerCoords]);

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBatteryInfo = () => {
          setMyBattery({ level: Math.round(battery.level * 100), isCharging: battery.charging });
        };
        updateBatteryInfo();
        battery.addEventListener('levelchange', updateBatteryInfo);
        battery.addEventListener('chargingchange', updateBatteryInfo);
      });
    }
  }, []);

  // Tổng đài giao tiếp WebSocket công nghệ thời gian thực
  useEffect(() => {
    setTimeout(() => {
        apiClient.post('/couple/video/sync', { action: 'request_location_sync', payload: null }).catch(console.error);
    }, 1500);

    const handleRemoteSignaling = (e: any) => {
      const { action, payload } = e.detail;
      
      if (action === 'request_location_sync') {
        if (isSharingRef.current && myCoordsRef.current) {
           apiClient.post('/couple/video/sync', {
              action: 'location_update',
              payload: { 
                lat: myCoordsRef.current[0], 
                lng: myCoordsRef.current[1], 
                battery: myBatteryRef.current?.level || null, 
                isCharging: myBatteryRef.current?.isCharging || false,
                stationarySince: myStationarySinceRef.current
              }
           }).catch(console.error);
        }
      }
      else if (action === 'location_update' && payload.lat && payload.lng) {
        const pCoords: [number, number] = [payload.lat, payload.lng];
        setPartnerCoords(pCoords);
        localStorage.setItem('partnerLastCoords', JSON.stringify(pCoords));

        if (payload.battery !== undefined) {
          setPartnerBattery({ level: payload.battery, isCharging: payload.isCharging });
        }
        if (payload.stationarySince !== undefined) {
          setPartnerStationarySince(payload.stationarySince);
          if (payload.stationarySince) {
            localStorage.setItem('partnerStationarySince', payload.stationarySince.toString());
          } else {
            localStorage.removeItem('partnerStationarySince');
          }
        }
      }
    };

    window.addEventListener('sync_video_event', handleRemoteSignaling);
    return () => window.removeEventListener('sync_video_event', handleRemoteSignaling);
  }, []);

  // Vòng lặp lấy vị trí liên tục và tối ưu hóa bộ nhớ đóng/mở tab
  useEffect(() => {
    let watchId: number;
    let heartbeatInterval: any;

    if (isSharing) {
      if (!navigator.geolocation) {
        setErrorMsg('Trình duyệt không hỗ trợ định vị.');
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const nowTime = Date.now();

          // 🌟 THUẬT TOÁN ĐỘC LẬP: Đọc dữ liệu lịch sử cứng từ localStorage để đối chiếu việc đứng yên
          const savedCoordsStr = localStorage.getItem('myLastCoords');
          const savedStationaryStr = localStorage.getItem('myStationarySince');
          
          let updatedStationaryTime = nowTime;

          if (savedCoordsStr && savedStationaryStr) {
            const [lastLat, lastLng] = JSON.parse(savedCoordsStr);
            const delta = Math.abs(latitude - lastLat) + Math.abs(longitude - lastLng);
            
            if (delta < 0.0003) {
              // Bạn vẫn đang đứng yên ở vị trí cũ dưới 30m -> Giữ nguyên mốc thời gian lịch sử
              updatedStationaryTime = parseInt(savedStationaryStr, 10);
            } else {
              // Bạn đã thực sự dịch chuyển đi chỗ khác -> Cập nhật vị trí mới & tính giờ lại từ đầu
              updatedStationaryTime = nowTime;
              localStorage.setItem('myLastCoords', JSON.stringify([latitude, longitude]));
            }
          } else {
            // Lần chạy đầu tiên chưa có lịch sử lưu trữ
            localStorage.setItem('myLastCoords', JSON.stringify([latitude, longitude]));
          }

          localStorage.setItem('myStationarySince', updatedStationaryTime.toString());
          
          setMyCoords([latitude, longitude]);
          setMyStationarySince(updatedStationaryTime);
          myStationarySinceRef.current = updatedStationaryTime;
          setErrorMsg('');

          const now = Date.now();
          if (now - lastSentTime.current > 3000) {
            apiClient.post('/couple/video/sync', {
              action: 'location_update',
              payload: { 
                lat: latitude, lng: longitude, 
                battery: myBatteryRef.current?.level, 
                isCharging: myBatteryRef.current?.isCharging,
                stationarySince: updatedStationaryTime
              }
            }).catch(console.error);
            lastSentTime.current = now;
          }
        },
        (error) => {
          if (error.code === 1) setErrorMsg('Chưa cấp quyền GPS.');
          else setErrorMsg('Không thể lấy vị trí.');
          setIsSharing(false);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );

      heartbeatInterval = setInterval(() => {
         if (isSharingRef.current && myCoordsRef.current) {
            apiClient.post('/couple/video/sync', {
              action: 'location_update',
              payload: { 
                lat: myCoordsRef.current[0], lng: myCoordsRef.current[1], 
                battery: myBatteryRef.current?.level, 
                isCharging: myBatteryRef.current?.isCharging,
                stationarySince: myStationarySinceRef.current
              }
            }).catch(console.error);
         }
      }, 4000);

    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [isSharing]);

  // Hàm xử lý bật/tắt thủ công sạch sẽ dữ liệu
  const handleToggleSharing = () => {
    const nextSharing = !isSharing;
    setIsSharing(nextSharing);
    if (!nextSharing) {
      // Nếu chủ động ấn DỪNG CHIA SẺ -> Tiến hành xóa sạch bộ nhớ tạm định vị của bản thân
      localStorage.removeItem('myLastCoords');
      localStorage.removeItem('myStationarySince');
      localStorage.removeItem('myAddress');
      setMyCoords(null);
      setMyStationarySince(null);
      setMyAddress('Chưa bật định vị');
      myStationarySinceRef.current = null;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col h-[75vh] min-h-137.5 gap-4 p-4 pt-24">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
        
        <div className="flex flex-col justify-center">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Heart className={`w-5 h-5 text-pink-500 ${isSharing || partnerCoords ? 'animate-pulse fill-pink-500' : ''}`} />
            Trạm Định Vị Tình Yêu
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isSharing ? 'Đang cập nhật địa điểm thực tế...' : 'Bản đồ đang tạm nghỉ.'}
          </p>
        </div>

        <div className="flex flex-col gap-2 justify-center bg-gray-50/80 p-3 sm:p-4 rounded-xl border border-gray-100 lg:col-span-1">
          {/* Khu vực hiển thị thông tin của BẠN */}
          <div className="flex flex-col gap-0.5 border-b border-gray-200/60 pb-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> Bạn</span>
              {myBattery && (
                <span className="flex items-center gap-0.5 font-semibold text-gray-600">
                  {myBattery.isCharging ? <BatteryCharging className="w-3 h-3 text-green-500" /> : <Battery className="w-3 h-3" />} {myBattery.level}%
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-500 truncate font-medium flex items-center gap-1 mt-0.5" title={myAddress}>
              <MapPin className="w-3 h-3 text-blue-500 shrink-0" /> {myAddress}
            </span>
            {isSharing && myStationarySince && (
              <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5 ml-4">
                <Clock className="w-3 h-3" /> {formatIdleTime(myStationarySince)}
              </span>
            )}
          </div>

          {/* Khu vực hiển thị thông tin của NGƯỜI ẤY */}
          <div className="flex flex-col gap-0.5 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-500 rounded-full"></span> Người ấy</span>
              {partnerBattery ? (
                <span className="flex items-center gap-0.5 font-semibold text-pink-500">
                  {partnerBattery.isCharging ? <BatteryCharging className="w-3 h-3 text-green-500" /> : <Battery className="w-3 h-3" />} {partnerBattery.level}%
                </span>
              ) : <span className="text-[10px] text-gray-400">--%</span>}
            </div>
            <span className="text-[11px] text-gray-600 truncate font-semibold flex items-center gap-1 mt-0.5" title={partnerAddress}>
              <MapPin className="w-3 h-3 text-pink-500 shrink-0" /> {partnerAddress}
            </span>
            {partnerCoords && partnerStationarySince && (
              <span className="text-[10px] text-pink-600 font-semibold flex items-center gap-1 mt-0.5 ml-4">
                <Clock className="w-3 h-3" /> {formatIdleTime(partnerStationarySince)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center lg:justify-end justify-start shrink-0">
          <button
            onClick={handleToggleSharing}
            className={`w-full lg:w-auto px-6 py-3 rounded-full font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 ${
              isSharing 
                ? 'bg-rose-100 text-rose-600 border border-rose-200 hover:bg-rose-200' 
                : 'bg-linear-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600'
            }`}
          >
            {isSharing ? ( <><PowerOff className="w-4 h-4" /> Dừng chia sẻ</> ) : ( <><Navigation className="w-4 h-4" /> Bật chia sẻ vị trí</> )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2 text-amber-700 text-xs">
          <ShieldAlert className="w-5 h-5 shrink-0" /> {errorMsg}
        </div>
      )}

      <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-inner relative z-10 bg-gray-100">
        <MapContainer center={partnerCoords || myCoords || [21.0285, 105.8542]} zoom={15} className="w-full h-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RecenterMap coords={isSharing ? myCoords : partnerCoords} />

          {myCoords && isSharing && (
            <Marker position={myCoords} icon={myIcon} zIndexOffset={100}>
              <Popup> 
                <div className="text-xs flex flex-col p-0.5 font-medium max-w-50">
                  <span className="font-bold text-blue-600">Bạn đang ở đây</span>
                  <span className="text-gray-500 mt-1 leading-relaxed">{myAddress}</span>
                  {myStationarySince && (
                    <span className="text-blue-600 mt-1 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatIdleTime(myStationarySince)}
                    </span>
                  )}
                </div> 
              </Popup>
            </Marker>
          )}

          {partnerCoords && (
            <Marker 
              position={[partnerCoords[0] + 0.0001, partnerCoords[1] + 0.0001]} 
              icon={partnerIcon} 
              zIndexOffset={200}
            >
              <Popup> 
                <div className="text-xs flex flex-col p-0.5 font-medium max-w-50">
                  <span className="font-bold text-pink-600">Nửa kia ở đây 💕</span>
                  <span className="text-gray-700 mt-1 font-semibold leading-relaxed">{partnerAddress}</span>
                  {partnerStationarySince && (
                    <span className="text-pink-600 mt-1 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatIdleTime(partnerStationarySince)}
                    </span>
                  )}
                </div> 
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {!isSharing && !partnerCoords && (
           <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <Navigation className="w-12 h-12 text-gray-400 mb-3" />
              <h3 className="font-bold text-gray-700 text-lg">Chưa có ai chia sẻ vị trí</h3>
              <p className="text-gray-500 text-sm mt-2 max-w-md">Hãy nhấn "Bật chia sẻ vị trí" ở góc trên để đối phương có thể nhìn thấy bạn nhé.</p>
           </div>
        )}
      </div>
    </div>
  );
};
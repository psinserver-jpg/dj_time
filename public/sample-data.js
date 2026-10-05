// 브라우저와 서버가 함께 쓰는 미리보기 데이터입니다. 실제 학교 시간표가 아닙니다.
(() => {
  const classes=Array.from({length:9},(_,i)=>({id:`${Math.floor(i/3)+1}|${i%3+1}|샘플|`,grade:String(Math.floor(i/3)+1),className:String(i%3+1),department:'샘플',course:''}));
  const subjects=[
    ['공통국어','공통수학','공통영어','컴퓨터 시스템','프로그래밍','체육','창의적 체험활동'],
    ['프로그래밍','프로그래밍','공통국어','통합과학','공통수학','한국사'],
    ['공통영어','컴퓨터 시스템','컴퓨터 시스템','통합사회','체육','공통국어','진로 활동'],
    ['공통수학','통합과학','프로그래밍','프로그래밍','한국사','공통영어'],
    ['통합사회','공통국어','공통수학','미술','컴퓨터 시스템','창의적 체험활동']
  ];
  function timetable({from,to,grade,className}){
    const rows=[];
    for(let date=new Date(from+'T00:00:00Z');date<=new Date(to+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+1)){
      const index=(date.getUTCDay()+6)%7;if(index>4)continue;
      const iso=date.toISOString().slice(0,10),rotation=(+grade-1)*3+(+className-1),day=subjects[index];
      day.forEach((_,i)=>rows.push({id:`${iso}-${i+1}`,date:iso,period:i+1,subject:day[(i+rotation)%day.length],department:'샘플'}));
    }
    return rows;
  }
  globalThis.DaejinTimetableSample=Object.freeze({classes,timetable});
})();

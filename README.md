# DGU_Mobius_Capstione_Design
TAS  &lt;->  nCube Thyme  &lt;->  Mobius 연동

nodemodules gitignore함!

Mobius/doc 참고
nCube-Thyme/doc 참고




<hr/>

- TAS는 따로 설계할 필요 없음. 통합감지센서에서 자체적으로 https통신. Thyeme에서 Rest API 호출만 잘해주면 됨.

-  nCube Thyeme  node.js 버전으로 설치. tas_sample 예제보고 플랫폼 이해요함. 타이머 설정해줘야함. Json parsing 해줘야함.

- Mobius DB에 각 테이블 대한 이해해야함. 
ex) cin table: 타임에서 수신받은 정보 쌓이는곳. con-생성데이터
ae table: Thyme의 정보 올라감

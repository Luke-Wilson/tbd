import React from 'react'

import { Col } from 'react-materialize'

function ProfileCardWrapper ({ children }) {
  return (
    <Col l={2}>
      { children }
    </Col>
  )
}

export default ProfileCardWrapper
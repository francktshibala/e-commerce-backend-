const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    image: String,
    sku: String,
    variantInfo: {
      type: Map,
      of: String
    }
  }],
  billing: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: String,
    address: {
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      zipCode: {
        type: String,
        required: true
      },
      country: {
        type: String,
        required: true
      }
    }
  },
  shipping: {
    name: {
      type: String,
      required: true
    },
    address: {
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      zipCode: {
        type: String,
        required: true
      },
      country: {
        type: String,
        required: true
      }
    },
    method: {
      type: String,
      required: true
    },
    cost: {
      type: Number,
      required: true,
      default: 0
    },
    trackingNumber: String,
    estimatedDelivery: Date
  },
  payment: {
    method: {
      type: String,
      required: true,
      enum: ['credit_card', 'paypal', 'stripe', 'bank_transfer']
    },
    transactionId: String,
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: Date
  },
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    required: true,
    default: 0
  },
  discount: {
    code: String,
    amount: {
      type: Number,
      default: 0
    }
  },
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  notes: String,
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    comment: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Generate unique order number
orderSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      // Generate order number based on timestamp and random string
      const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.orderNumber = `ORD-${timestamp.substring(0, 8)}-${random}`;
      
      // Add initial status to history
      if (!this.statusHistory || this.statusHistory.length === 0) {
        this.statusHistory = [{
          status: this.status,
          timestamp: new Date(),
          comment: 'Order created'
        }];
      }
    } else if (this.isModified('status')) {
      // Add status change to history
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date()
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Update inventory after order is placed
orderSchema.post('save', async function() {
  try {
    if (this.status === 'pending' || this.status === 'processing') {
      const Product = mongoose.model('Product');
      
      // Update inventory for each product
      for (const item of this.items) {
        await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: {
              'inventory.reserved': item.quantity
            }
          }
        );
      }
    }
  } catch (error) {
    console.error('Error updating inventory:', error);
  }
});

// Methods
orderSchema.methods.updateStatus = async function(status, comment, userId) {
  this.status = status;
  this.statusHistory.push({
    status,
    timestamp: new Date(),
    comment,
    updatedBy: userId
  });
  
  return this.save();
};

orderSchema.methods.cancel = async function(reason, userId) {
  if (this.status !== 'pending' && this.status !== 'processing') {
    throw new Error('Only pending or processing orders can be cancelled');
  }
  
  // Update status
  this.status = 'cancelled';
  this.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    comment: reason || 'Order cancelled',
    updatedBy: userId
  });
  
  // Release reserved inventory
  const Product = mongoose.model('Product');
  for (const item of this.items) {
    await Product.findByIdAndUpdate(
      item.product,
      {
        $inc: {
          'inventory.reserved': -item.quantity
        }
      }
    );
  }
  
  return this.save();
};

// Create indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ user: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;